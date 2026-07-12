# Notification Engine

## Purpose

The Notification Engine handles cross-platform push notifications (Firebase Cloud Messaging / APNs) and Email delivery for critical events (such as device offline alerts, ownership transfers, security alerts, and system notifications). It implements a robust retry system with exponential backoff.

## Architecture

- **Clean Layer Separation:** Decoupled persistence layers, handlers, and external communication providers.
- **Provider Abstraction:** The Service sends push alerts and emails through the `PushProvider` and `EmailProvider` interfaces, ensuring pluggability.
- **In-Memory/Mock Providers:** Includes full Mock implementations for testing delivery logs and simulated failures.
- **Retry System:** Uses persistent `notification_queue` with exponential backoff on failure.

## Database Schema

- **notifications:** Holds user-facing notification history logs.
- **notification_queue:** Implements a queuing system for pending deliveries, error tracking, and exponential retry delays.

## API Endpoints

Mounted under `/cloud/notifications` and `/cloud/api/engines/notifications`.

- `POST /` — Send/Trigger a notification for a user (Auth required)
- `GET /` — List notification history of the authenticated user (Auth required)
- `POST /mark-read` — Mark an array of notification IDs as read (Auth required)
