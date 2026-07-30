package email

import (
	"crypto/tls"
	"fmt"
	"net/smtp"

	"go.uber.org/zap"
)

type Provider interface {
	SendEmail(to, subject, body string) error
}

type ConsoleProvider struct {
	logger *zap.Logger
}

func NewConsoleProvider(logger *zap.Logger) Provider {
	return &ConsoleProvider{logger: logger}
}

func (p *ConsoleProvider) SendEmail(to, subject, body string) error {
	p.logger.Info("----------------- EMAIL DISPATCHED (CONSOLE) -----------------",
		zap.String("to", to),
		zap.String("subject", subject),
		zap.String("body", body),
	)
	p.logger.Info("-------------------------------------------------------------")
	return nil
}

type MockProvider struct {
	SentEmails []SentEmail
}

type SentEmail struct {
	To      string
	Subject string
	Body    string
}

func NewMockProvider() *MockProvider {
	return &MockProvider{SentEmails: make([]SentEmail, 0)}
}

func (p *MockProvider) SendEmail(to, subject, body string) error {
	p.SentEmails = append(p.SentEmails, SentEmail{To: to, Subject: subject, Body: body})
	return nil
}

type SMTPProvider struct {
	host     string
	port     int
	user     string
	password string
	from     string
	logger   *zap.Logger
}

func NewSMTPProvider(host string, port int, user, password, from string, logger *zap.Logger) Provider {
	if host == "" {
		logger.Warn("SMTP host is empty, initializing fallback ConsoleProvider")
		return NewConsoleProvider(logger)
	}
	return &SMTPProvider{
		host:     host,
		port:     port,
		user:     user,
		password: password,
		from:     from,
		logger:   logger,
	}
}

func (p *SMTPProvider) SendEmail(to, subject, body string) error {
	p.logger.Info("sending smtp email", zap.String("to", to), zap.String("subject", subject))

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s", p.from, to, subject, body)
	addr := fmt.Sprintf("%s:%d", p.host, p.port)

	auth := smtp.PlainAuth("", p.user, p.password, p.host)

	// Direct SSL/TLS connection vs STARTTLS fallback
	if p.port == 465 {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         p.host,
		}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return err
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, p.host)
		if err != nil {
			return err
		}
		defer client.Quit()

		if err = client.Auth(auth); err != nil {
			return err
		}
		if err = client.Mail(p.from); err != nil {
			return err
		}
		if err = client.Rcpt(to); err != nil {
			return err
		}
		w, err := client.Data()
		if err != nil {
			return err
		}
		_, err = w.Write([]byte(msg))
		if err != nil {
			return err
		}
		err = w.Close()
		return err
	}

	// Normal SMTP or STARTTLS on 587 or 25
	return smtp.SendMail(addr, auth, p.from, []string{to}, []byte(msg))
}
