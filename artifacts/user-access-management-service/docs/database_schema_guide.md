# LUMA User Access Management Service (UAMS)
## Phase 10 — Database Schema Reference Guide

This guide details the schemas and compound constraints maintained in the UAMS MongoDB persistent layer.

### 1. role_assignments
```json
{
  "_id": "UUID (uuid)",
  "user_id": "UUID (uuid)",
  "microcontroller_id": "UUID (uuid)",
  "role": "String (owner | administrator | operator | viewer)",
  "assigned_by": "UUID (uuid)",
  "status": "String (active | revoked)",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
* **Compound Constraint**: Unique index on `{user_id: 1, microcontroller_id: 1}` ensures a user has exactly one active role per controller.

### 2. permissions
```json
{
  "_id": "UUID (uuid)",
  "user_id": "UUID (uuid)",
  "microcontroller_id": "UUID (uuid)",
  "resource_id": "String (resource identifier)",
  "resource_type": "String (microcontroller | home | room | device | feature)",
  "allowed_actions": ["String (view | control | configure | schedule | share | manage | firmware)"],
  "granted_by": "UUID (uuid)",
  "role_source": "String (owner | administrator | operator | viewer | custom)",
  "status": "String (active | expired | revoked)",
  "temporary": "Boolean",
  "start_time": "ISODate (optional)",
  "end_time": "ISODate (optional)",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
* **Compound Constraint**: Unique index on `{user_id: 1, microcontroller_id: 1, resource_id: 1, resource_type: 1}`.

### 3. permission_keys
```json
{
  "_id": "UUID (uuid)",
  "user_id": "UUID (uuid)",
  "resource_id": "String",
  "permission_id": "UUID (uuid)",
  "key_hash": "String (sha256 hex)",
  "type": "String (user_permission | device_permission | temporary)",
  "status": "String (active | revoked | expired)",
  "expires_at": "ISODate (optional)",
  "created_at": "ISODate",
  "revoked_at": "ISODate (optional)"
}
```
* **Unique Constraint**: Unique index on `{key_hash: 1}` prevents collisions and guarantees timing-safe lookup.

### 4. invitations
```json
{
  "_id": "UUID (uuid)",
  "sender_id": "UUID (uuid)",
  "recipient_email": "String (email format)",
  "recipient_phone": "String (optional)",
  "resource_id": "String",
  "resource_type": "String",
  "permission_level": "String",
  "personal_message": "String",
  "status": "String (pending | accepted | rejected | cancelled | expired | revoked)",
  "expires_at": "ISODate",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

### 5. access_requests
```json
{
  "_id": "UUID (uuid)",
  "requester_id": "UUID (uuid)",
  "owner_id": "UUID (uuid)",
  "resource_id": "String",
  "resource_type": "String",
  "requested_role": "String",
  "requested_duration": "Number (optional, hours)",
  "message": "String",
  "status": "String (pending | approved | rejected | cancelled | expired | withdrawn)",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

### 6. ownership_transfers
```json
{
  "_id": "UUID (uuid)",
  "microcontroller_id": "UUID (uuid)",
  "current_owner_id": "UUID (uuid)",
  "new_owner_email": "String",
  "status": "String (pending | accepted | rejected | cancelled)",
  "reason": "String",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

### 7. cloud_sync_records
```json
{
  "_id": "UUID (uuid)",
  "user_id": "UUID (uuid)",
  "resource_id": "String",
  "resource_type": "String",
  "data": "Object (serialized metadata)",
  "version": "Number",
  "deleted": "Boolean",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
* **Compound Constraint**: Unique index on `{user_id: 1, resource_type: 1, resource_id: 1}`.
