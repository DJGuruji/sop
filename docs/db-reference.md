# 📄 Requirements Document – SOP & Policy Management System

---

## 1. Project Overview

This project is a web-based application designed to manage and store organizational Policies and Standard Operating Procedures (SOPs).

The system will allow employees across departments to:

* View policies and SOPs
* Create documents using predefined templates
* Submit documents for approval
* Track versions and changes

The platform ensures proper governance through role-based access, approval workflows, and audit tracking.

---

## 2. User Roles

The system will have the following roles:

* Super Admin
* Admin
* Department Admin
* Supervisor
* Employee (View-only user)

---

## 3. Role-Based Access Control

---

### 3.1 Super Admin

The Super Admin has complete system control:

* Full access to all SOPs and policies (Create, Read, Edit, Delete)
* Create and manage:

  * Departments
  * Admins
  * Department Admins
  * Supervisors
* View logs of all users
* Final authority over approvals and publishing
* Super Admin logs are **not visible to any other role**

---

### 3.2 Admin

Admins are created by the Super Admin and have the following permissions:

* Access to all SOPs and policies across departments
* Create, edit, publish, and unpublish SOPs and policies
* Delete published SOPs and policies
* View logs of Department Admins
* View all employees
* Create departments

---

### 3.3 Department Admin

Department Admins manage their respective departments:

* Create and manage Supervisors
* Create, edit, publish, and unpublish SOPs and policies
* Delete published SOPs and policies within their department
* Review SOPs/policies submitted by Supervisors
* Approve, reject, or escalate to Admin
* View logs of Supervisors

---

### 3.4 Supervisor

Supervisors operate within a department or sub-department:

* Access SOPs and policies of their assigned department
* Create and edit SOPs and policies
* Delete their own created documents **only before submission for approval**
* Submit SOPs/policies for approval to Department Admin

#### Restrictions:

* Once a document is submitted for approval:

  * It **cannot be edited or deleted**
* Supervisors **cannot delete published documents**

---

### 3.5 Employee (View-Only User)

Employees have limited access:

* Can view SOPs and policies
* No permission to create, edit, delete, or approve

---

## 4. Approval Workflow

1. Supervisor creates or edits an SOP/policy
2. Supervisor submits it for approval
3. After submission:

   * Editing and deletion are **locked for the requester**
4. Department Admin reviews and can:

   * Approve and publish
   * Reject
   * Forward to Admin
5. Admin can:

   * Approve and publish directly
   * Unpublish or delete if required

---

## 5. Document Management Rules

### 5.1 Editing Rules

* Only the **latest version** of an SOP/policy can be edited
* Older versions are:

  * Viewable
  * Not editable

---

### 5.2 Deletion Rules

* Supervisors:

  * Can delete **only their own documents before approval submission**
* After submission:

  * Delete option is disabled
* Published documents:

  * Can be deleted **only by Admin and Department Admin**

---

## 6. Version Control

* Every SOP/policy maintains version history
* The system stores:

  * All previous versions (read-only)
  * One latest active version (editable)
* Frontend will:

  * Show all versions
  * Allow editing only for the latest version

---

## 7. Notifications

* Email notifications will be sent for:

  * Creation
  * Submission for approval
  * Approval / rejection
  * Publishing / unpublishing
* Notifications are sent to:

  * Requestor
  * Approver(s)
  * Higher authority (if escalated)

---

## 8. Audit & Logging System

All user activities will be logged.

### Log Visibility Rules (Updated)

* Super Admin:

  * Can view logs of **all users**
  * Their logs are **not visible to any other role**

* Admin:

  * Logs are visible **only to Super Admin**

* Department Admin:

  * Logs are visible to **Admins and Super Admin**
  * Not visible to Supervisors

* Supervisor:

  * Logs are visible to **Department Admins**

---

## 9. Frontend Dashboard Features

---

### 9.1 Admin Dashboard

* SOPs/policies created by them
* Requests received for approval
* Approved and rejected items
* All SOP versions (with latest highlighted)
* Full access to all documents

---

### 9.2 Department Admin Dashboard

* SOPs/policies created by them
* Requests from Supervisors
* Approved and rejected items
* Version history (all versions visible)
* Department-specific documents

---

### 9.3 Supervisor Dashboard

* SOPs/policies created by them
* Submission status (pending/approved/rejected)
* Ability to:

  * Edit latest drafts
  * Delete drafts (before submission)

---

### 9.4 Employee Dashboard

* View all accessible SOPs and policies
* No editing or creation capabilities

---

## 10. Key System Highlights

* Role-based access control (RBAC)
* Template-based SOP/policy creation
* Approval workflow with hierarchy
* Version control with edit restrictions
* Strict document lifecycle rules
* Full audit trail and activity logging
* Email notification system

---

✅ This document represents the finalized functional requirements for the SOP & Policy Management System.




#currently plannned db 