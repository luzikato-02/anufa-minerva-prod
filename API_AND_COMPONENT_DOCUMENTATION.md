# API and Component Documentation

This document provides comprehensive documentation for all public APIs, functions, and components in the application. This is a Laravel + React (Inertia.js) application for manufacturing operations management.

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
   - [Authentication API](#authentication-api)
   - [Tension Records API](#tension-records-api)
   - [Stock Take Records API](#stock-take-records-api)
   - [Finish Earlier Records API](#finish-earlier-records-api)
   - [Settings API](#settings-api)
2. [Data Models](#data-models)
   - [User Model](#user-model)
   - [TensionRecord Model](#tensionrecord-model)
   - [StockTakingRecord Model](#stocktakingrecord-model)
   - [FinishEarlierRecord Model](#finishearlierrecord-model)
3. [React Components](#react-components)
   - [Feature Components](#feature-components)
   - [UI Components](#ui-components)
   - [Layout Components](#layout-components)
4. [Utility Functions](#utility-functions)
5. [Custom Hooks](#custom-hooks)
6. [TypeScript Interfaces](#typescript-interfaces)

---

## API Endpoints

### Authentication API

All authentication routes are handled via Laravel Fortify and Sanctum.

#### Web Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/login` | Display login form | No |
| POST | `/login` | Authenticate user | No |
| POST | `/logout` | Logout current user | Yes |
| GET | `/forgot-password` | Display password reset request form | No |
| POST | `/forgot-password` | Send password reset email | No |
| GET | `/reset-password/{token}` | Display password reset form | No |
| POST | `/reset-password` | Reset user password | No |
| GET | `/verify-email` | Display email verification notice | Yes |
| GET | `/verify-email/{id}/{hash}` | Verify email address | Yes |
| POST | `/email/verification-notification` | Resend verification email | Yes |

#### Mobile API Authentication

**Login**
```http
POST /api/mobile/login
Content-Type: application/json

{
  "login": "user@example.com",  // Can be email or username
  "password": "secret123"
}
```

**Response (Success - 200):**
```json
{
  "access_token": "1|laravel_sanctum_token...",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "username": "johndoe"
  }
}
```

**Response (Error - 401):**
```json
{
  "message": "Invalid credentials"
}
```

**Logout**
```http
POST /api/mobile/logout
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "Logged out"
}
```

---

### Tension Records API

Tension Records track twisting and weaving tension measurements in manufacturing.

#### List Tension Records

```http
GET /tension-records
GET /api/mobile/tension-records
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Global search across record type, CSV data, operator, machine number |
| `type` | string | Filter by record type (`twisting` or `weaving`) |
| `operator` | string | Filter by operator name |
| `machine` | string | Filter by machine number |
| `per_page` | integer | Records per page (default: 10) |
| `page` | integer | Page number |

**Response:**
```json
{
  "current_page": 1,
  "data": [
    {
      "id": 1,
      "record_type": "twisting",
      "csv_data": "TWISTING TENSION DATA EXPORT...",
      "form_data": { "machineNumber": "M001", "operator": "John" },
      "measurement_data": { "1": { "max": 25, "min": 20 } },
      "problems": [],
      "metadata": {
        "total_measurements": 84,
        "completed_measurements": 42,
        "progress_percentage": 50,
        "operator": "John",
        "machine_number": "M001",
        "item_number": "ITEM001",
        "yarn_code": "YC001"
      },
      "created_at": "2025-12-16T10:00:00.000000Z",
      "updated_at": "2025-12-16T10:00:00.000000Z"
    }
  ],
  "last_page": 5,
  "per_page": 10,
  "total": 50
}
```

#### Create Tension Record

```http
POST /tension-records
POST /api/mobile/tension-records
Authorization: Bearer {token}
Content-Type: application/json
X-XSRF-TOKEN: {csrf_token}

{
  "record_type": "twisting",
  "csv_data": "TWISTING TENSION DATA EXPORT...",
  "form_data": {
    "machineNumber": "M001",
    "itemNumber": "ITEM001",
    "metersCheck": "1000",
    "operator": "John Doe",
    "dtexNumber": "100",
    "tpm": "500",
    "specTens": "25",
    "tensPlus": "5",
    "rpm": "3000",
    "yarnCode": "YC001"
  },
  "measurement_data": {
    "1": { "max": 25, "min": 20 },
    "2": { "max": 26, "min": 21 }
  },
  "problems": [
    {
      "id": 1,
      "spindleNumber": 5,
      "description": "Broken thread",
      "timestamp": "2025-12-16T10:00:00Z"
    }
  ],
  "metadata": {
    "total_measurements": 84,
    "completed_measurements": 42,
    "progress_percentage": 50,
    "operator": "John Doe",
    "machine_number": "M001",
    "item_number": "ITEM001",
    "yarn_code": "YC001"
  }
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "Tension record saved successfully",
  "data": { /* created record */ }
}
```

#### Get Single Tension Record

```http
GET /tension-records/{id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "status": "success",
  "data": { /* tension record object */ }
}
```

#### Update Tension Record

```http
PUT /tension-records/{id}
Authorization: Bearer {token}
Content-Type: application/json
X-XSRF-TOKEN: {csrf_token}

{
  "record_type": "twisting",
  "csv_data": "Updated CSV data...",
  "metadata": { "operator": "Jane Doe" }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Tension record updated successfully",
  "data": { /* updated record */ }
}
```

#### Delete Tension Record

```http
DELETE /tension-records/{id}
Authorization: Bearer {token}
X-XSRF-TOKEN: {csrf_token}
```

**Response:**
```json
{
  "status": "success",
  "message": "Tension record deleted successfully"
}
```

#### Download Tension Record CSV

```http
GET /tension-records/{id}/download
Authorization: Bearer {token}
```

**Response:** CSV file download with Content-Type: text/csv

#### Get Tension Statistics

```http
GET /tension-statistics
Authorization: Bearer {token}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "total_records": 100,
    "twisting_records": 60,
    "weaving_records": 40,
    "recent_records": [ /* last 5 records */ ],
    "operators": ["John", "Jane", "Bob"],
    "machines": ["M001", "M002", "M003"],
    "twisting_problems": 5,
    "weaving_problems": 3
  }
}
```

#### Get Records by Type

```http
GET /tension-records/type/{type}
Authorization: Bearer {token}
```

Where `{type}` is either `twisting` or `weaving`.

---

### Stock Take Records API

Stock Take Records manage inventory batch verification sessions.

#### List Stock Take Records

```http
GET /stock-take-records
GET /api/mobile/stock-take-records
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Global search |
| `session_leader` | string | Filter by session leader |
| `per_page` | integer | Records per page (default: 10) |

**Response:**
```json
{
  "current_page": 1,
  "data": [
    {
      "id": 1,
      "session_id": "123456",
      "indv_batch_data": [ /* batch data array */ ],
      "recorded_batches": [ /* recorded batches */ ],
      "stock_take_summary": [ /* combined summary */ ],
      "metadata": {
        "total_batches": 100,
        "total_materials": 25,
        "total_checked_batches": 50,
        "session_leader": "John Doe",
        "session_status": "In Progress"
      },
      "created_at": "2025-12-16T10:00:00.000000Z"
    }
  ],
  "last_page": 5,
  "per_page": 10,
  "total": 50
}
```

#### Create Stock Take Session

```http
POST /stock-take-records
Authorization: Bearer {token}
Content-Type: application/json
X-XSRF-TOKEN: {csrf_token}

{
  "indv_batch_data": [
    {
      "batch_number": "BATCH001",
      "material_code": "MAT001",
      "material_description": "Cotton Yarn"
    },
    {
      "batch_number": "BATCH002",
      "material_code": "MAT002",
      "material_description": "Polyester Thread"
    }
  ],
  "metadata": {
    "total_batches": 2,
    "total_materials": 2,
    "total_checked_batches": 0,
    "session_leader": "John Doe",
    "session_status": "In Progress"
  }
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "New stock take session initiated.",
  "data": {
    "id": 1,
    "session_id": "123456",
    /* full record data */
  }
}
```

#### Get Session Data

```http
GET /stock-take-records/session/{sessionId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Session loaded successfully"
}
```

#### Check Batch Existence

```http
GET /stock-take-records/check-batch?record_key={sessionId}&batch={batchNumber}
Authorization: Bearer {token}
```

**Response (Batch Found, Not Recorded):**
```json
{
  "exists": true,
  "already_recorded": false,
  "batch_data": {
    "batch_number": "BATCH001",
    "material_code": "MAT001",
    "material_description": "Cotton Yarn"
  },
  "message": "Batch is valid but not \"found\" yet."
}
```

**Response (Already Recorded):**
```json
{
  "exists": true,
  "already_recorded": true,
  "batch_data": { /* batch data */ },
  "message": "Batch already found. Move to the next batch."
}
```

**Response (Not Found):**
```json
{
  "exists": false,
  "message": "Batch not found in this session"
}
```

#### Record Batch

```http
POST /stock-take-records/record-batch
Authorization: Bearer {token}
Content-Type: application/json
X-XSRF-TOKEN: {csrf_token}

{
  "session_id": "123456",
  "batch_number": "BATCH001",
  "material_code": "MAT001",
  "material_description": "Cotton Yarn",
  "actual_weight": 25.5,
  "total_bobbins": 10,
  "line_position": 5,
  "row_position": "A",
  "timestamp": "2025-12-16T10:00:00Z",
  "user_found": "John Doe",
  "explanation": "Found in storage area B"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Batch recorded successfully",
  "data": { /* recorded batch data */ }
}
```

#### Update Session Status

```http
PATCH /stock-take-records/{id}/status
Authorization: Bearer {token}
Content-Type: application/json
X-XSRF-TOKEN: {csrf_token}

{
  "session_status": "Completed"
}
```

Valid status values: `"In Progress"`, `"Completed"`

**Response:**
```json
{
  "success": true,
  "message": "Session status updated successfully.",
  "data": {
    "session_id": "123456",
    "session_status": "Completed"
  }
}
```

#### Download Stock Take Summary

```http
GET /stock-take-records/{id}/download
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "session_id": "123456",
  "summary": [
    {
      "batch_number": "BATCH001",
      "material_code": "MAT001",
      "is_recorded": true,
      "actual_weight": 25.5,
      "total_bobbins": 10
    }
  ]
}
```

---

### Finish Earlier Records API

Finish Earlier Records track early completion events in production.

#### List Finish Earlier Records

```http
GET /finish-earlier
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `per_page` | integer | Records per page (default: 10) |

**Response:**
```json
{
  "current_page": 1,
  "data": [
    {
      "id": 1,
      "metadata": {
        "machine_number": "M001",
        "style": "STYLE001",
        "production_order": "PO12345",
        "roll_construction": "2x2 Twill",
        "shift_group": "A",
        "total_finish_earlier": 5,
        "average_meters_finish": 150
      },
      "entries": [
        {
          "creel_side": "A",
          "row_number": "1",
          "column_number": "5",
          "meters_finish": 150
        }
      ],
      "created_at": "2025-12-16T10:00:00.000000Z"
    }
  ],
  "last_page": 5,
  "per_page": 10,
  "total": 50
}
```

#### Get Single Finish Earlier Record

```http
GET /finish-earlier/{id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "Record fetched.",
  "data": { /* record object */ }
}
```

#### Start New Session

```http
POST /finish-earlier/start-session
Authorization: Bearer {token}
Content-Type: application/json
X-XSRF-TOKEN: {csrf_token}

{
  "machine_number": "M001",
  "style": "STYLE001",
  "production_order": "PO12345",
  "roll_construction": "2x2 Twill",
  "shift_group": "A"
}
```

**Response:**
```json
{
  "message": "Session created successfully.",
  "id": 1,
  "data": { /* created record */ }
}
```

#### Get Session by Production Order

```http
GET /finish-earlier/session/{productionOrder}
Authorization: Bearer {token}
```

**Response:** Full record JSON or 404 if not found.

#### Add Entry to Session

```http
POST /finish-earlier/{productionOrder}/add-entry
Authorization: Bearer {token}
Content-Type: application/json
X-XSRF-TOKEN: {csrf_token}

{
  "creel_side": "A",
  "row_number": "1",
  "column_number": "5",
  "meters_finish": 150
}
```

**Response:**
```json
{
  "message": "Entry added and metadata updated.",
  "record": { /* updated record */ }
}
```

#### Finish Session

```http
POST /finish-earlier/{id}/finish
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "Recording finished.",
  "data": { /* record with calculated totals */ }
}
```

#### Delete Record

```http
DELETE /finish-earlier/{id}
Authorization: Bearer {token}
X-XSRF-TOKEN: {csrf_token}
```

**Response:**
```json
{
  "message": "Record deleted successfully."
}
```

#### Export to PDF

```http
GET /finish-earlier/{productionOrder}/pdf
Authorization: Bearer {token}
```

**Response:** PDF file download

#### Download CSV Data

```http
GET /finish-earlier/{productionOrder}/download
Authorization: Bearer {token}
```

**Response:**
```json
{
  "metadata": { /* session metadata */ },
  "entries": [ /* all entries */ ]
}
```

---

### Settings API

#### Profile Management

```http
GET /settings/profile
PATCH /settings/profile
DELETE /settings/profile
Authorization: Bearer {token}
```

**Update Profile:**
```http
PATCH /settings/profile
Content-Type: application/json
X-XSRF-TOKEN: {csrf_token}

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

#### Password Management

```http
GET /settings/password
PUT /settings/password
Authorization: Bearer {token}
```

**Update Password:**
```http
PUT /settings/password
Content-Type: application/json
X-XSRF-TOKEN: {csrf_token}

{
  "current_password": "old_password",
  "password": "new_password",
  "password_confirmation": "new_password"
}
```

#### Two-Factor Authentication

```http
GET /settings/two-factor
Authorization: Bearer {token}
```

---

## Data Models

### User Model

**Table:** `users`

| Field | Type | Description |
|-------|------|-------------|
| id | bigint | Primary key |
| name | string | User's full name |
| email | string | Unique email address |
| username | string | Unique username (for mobile login) |
| password | string | Hashed password |
| email_verified_at | timestamp | Email verification timestamp |
| two_factor_secret | text | Encrypted 2FA secret |
| two_factor_recovery_codes | text | Encrypted recovery codes |
| remember_token | string | Remember me token |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |

**Traits:**
- `HasFactory` - Factory support for testing
- `Notifiable` - Email notifications
- `TwoFactorAuthenticatable` - 2FA support via Fortify
- `HasApiTokens` - Sanctum API tokens

---

### TensionRecord Model

**Table:** `tension_records`

| Field | Type | Description |
|-------|------|-------------|
| id | bigint | Primary key |
| record_type | string | `twisting` or `weaving` |
| csv_data | text | Exported CSV data |
| form_data | json | Form configuration data |
| measurement_data | json | Spindle/creel measurements |
| problems | json | Array of reported problems |
| metadata | json | Summary and identification data |
| user_id | bigint | Foreign key to users table |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |
| deleted_at | timestamp | Soft delete timestamp |

**Metadata Structure:**
```json
{
  "total_measurements": 84,
  "completed_measurements": 42,
  "progress_percentage": 50,
  "operator": "John Doe",
  "machine_number": "M001",
  "item_number": "ITEM001",
  "item_description": "Cotton Fabric",
  "yarn_code": "YC001"
}
```

**Query Scopes:**

```php
// Filter by record type
TensionRecord::byType('twisting')->get();

// Filter by operator
TensionRecord::byOperator('John Doe')->get();

// Filter by machine number
TensionRecord::byMachine('M001')->get();
```

**Accessors:**

```php
$record->operator;           // From metadata->operator
$record->machine_number;     // From metadata->machine_number
$record->item_number;        // From metadata->item_number
$record->progress_percentage;// From metadata->progress_percentage
$record->total_measurements; // From metadata->total_measurements
$record->completed_measurements; // From metadata->completed_measurements
```

---

### StockTakingRecord Model

**Table:** `stock_taking_records`

| Field | Type | Description |
|-------|------|-------------|
| id | bigint | Primary key |
| session_id | string | 6-digit unique session identifier |
| indv_batch_data | json | Array of batch records from CSV |
| recorded_batches | json | Array of verified batches |
| stock_take_summary | json | Combined summary (auto-generated) |
| metadata | json | Session metadata |
| user_id | bigint | Foreign key to users table |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |
| deleted_at | timestamp | Soft delete timestamp |

**Metadata Structure:**
```json
{
  "total_batches": 100,
  "total_materials": 25,
  "total_checked_batches": 50,
  "session_leader": "John Doe",
  "session_status": "In Progress"
}
```

**Batch Data Structure:**
```json
{
  "batch_number": "BATCH001",
  "material_code": "MAT001",
  "material_description": "Cotton Yarn"
}
```

**Recorded Batch Structure:**
```json
{
  "batch_number": "BATCH001",
  "material_code": "MAT001",
  "material_description": "Cotton Yarn",
  "actual_weight": 25.5,
  "total_bobbins": 10,
  "line_position": 5,
  "row_position": "A",
  "timestamp_found": "2025-12-16T10:00:00Z",
  "user_found": "John Doe",
  "explanation": "Found in storage area B",
  "recorded_at": "2025-12-16T10:05:00Z"
}
```

**Auto-generated Summary:**
The `stock_take_summary` field is automatically computed on save by combining `indv_batch_data` with `recorded_batches`:

```php
public function combineBatchData()
{
    // Merges original batch list with recorded findings
    // Returns combined array with is_recorded flag
}
```

---

### FinishEarlierRecord Model

**Table:** `finish_earlier_records`

| Field | Type | Description |
|-------|------|-------------|
| id | bigint | Primary key |
| metadata | json | Session metadata |
| entries | json | Array of finish earlier entries |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |

**Metadata Structure:**
```json
{
  "machine_number": "M001",
  "style": "STYLE001",
  "production_order": "PO12345",
  "roll_construction": "2x2 Twill",
  "shift_group": "A",
  "total_finish_earlier": 5,
  "average_meters_finish": 150
}
```

**Entry Structure:**
```json
{
  "creel_side": "A",
  "row_number": "1",
  "column_number": "5",
  "meters_finish": 150
}
```

**Methods:**

```php
// Add entry and auto-recalculate metadata
$record->addEntry([
    'creel_side' => 'A',
    'row_number' => '1',
    'column_number' => '5',
    'meters_finish' => 150
]);
```

---

## React Components

### Feature Components

#### `BatchStockTakingForm`

Main component for batch stock taking operations with barcode scanning support.

**File:** `resources/js/components/batch-stock-taking.tsx`

**Usage:**
```tsx
import BatchStockTakingForm from '@/components/batch-stock-taking';

function StockTakingPage() {
  return <BatchStockTakingForm />;
}
```

**Features:**
- Session selection and validation
- Batch number lookup with barcode scanning
- Recording modal for batch details (weight, bobbins, position)
- Error and success state handling
- Enter key support for quick navigation

**Internal State:**
- `sessionId` - Current session identifier
- `sessionSelected` - Whether a valid session is active
- `batchNumber` - Current batch being looked up
- `showRecordingModal` - Controls batch recording dialog
- `currentBatchData` - Data for the batch being recorded

---

#### `TwistingTensionPage`

Main component for twisting tension measurement recording.

**File:** `resources/js/components/twisting-tension-record.tsx`

**Usage:**
```tsx
import TwistingTensionPage from '@/components/twisting-tension-record';

function TwistingPage() {
  return <TwistingTensionPage />;
}
```

**Features:**
- Multi-view navigation (params → numpad → problems)
- Spindle data persistence via localStorage
- Problem reporting per spindle
- Auto-save to localStorage on state changes
- Complete data reset after submission

**Props for Child Components:**

```tsx
// TwistingParams
interface TwistingParamsProps {
  formData: TensionData;
  setFormData: (data: TensionData) => void;
  onStartRecording: () => void;
}

// TwistingNumpad
interface TwistingNumpadProps {
  display: string;
  setDisplay: (value: string) => void;
  counter: number;
  setCounter: (value: number) => void;
  valueType: string;
  setValueType: (value: string) => void;
  spindleData: Record<number, SpindleData>;
  setSpindleData: (data: Record<number, SpindleData>) => void;
  formData: TensionData;
  problems: SubmittedProblem[];
  onReportProblem: (spindleNumber: number) => void;
  onOpenRecorder: () => void;
  onDataCleared: () => void;
}
```

---

#### `WeavingTensionPage`

Main component for weaving tension measurement recording.

**File:** `resources/js/components/weaving-tension-record.tsx`

**Usage:**
```tsx
import WeavingTensionPage from '@/components/weaving-tension-record';

function WeavingPage() {
  return <WeavingTensionPage />;
}
```

**Features:**
- Creel-based data structure (AI, BI, AO, BO sides)
- Row and column navigation
- Problem reporting by position
- localStorage persistence
- Complete data reset after submission

**Creel Data Structure:**
```tsx
interface CreelData {
  [side: string]: {        // AI, BI, AO, BO
    [row: string]: {       // A, B, C, D, E
      [col: number]: {     // 1-120
        max: number | null;
        min: number | null;
      }
    }
  }
}
```

---

#### `StockTakeDataTable`

Data table for displaying and managing stock take sessions.

**File:** `resources/js/components/st-data-table.tsx`

**Usage:**
```tsx
import { StockTakeDataTable } from '@/components/st-data-table';

function StockTakeRecordsPage() {
  return <StockTakeDataTable />;
}
```

**Features:**
- Server-side pagination and filtering
- Column visibility toggles
- Create new session dialog with CSV upload
- View session details dialog
- Change session status
- Download CSV summary
- Global search

**Columns:**
- Record Date
- Session ID
- Session Leader
- Session Status (with badges)
- Total Materials
- Total Batches
- Total Found Batches
- Actions (view, download, change status)

---

#### `BarcodeScanner`

Camera-based barcode scanning component using QuaggaJS.

**File:** `resources/js/components/barcode-scanning.tsx`

**Usage:**
```tsx
import { BarcodeScanner } from '@/components/barcode-scanning';

function MyComponent() {
  const [showScanner, setShowScanner] = useState(false);
  
  const handleScan = (barcode: string) => {
    console.log('Scanned:', barcode);
  };

  return (
    <>
      <button onClick={() => setShowScanner(true)}>Scan</button>
      <BarcodeScanner
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
      />
    </>
  );
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `open` | boolean | Controls dialog visibility |
| `onClose` | () => void | Called when dialog closes |
| `onScan` | (barcode: string) => void | Called with scanned barcode |

**Supported Barcode Types:**
- Code 128
- EAN-13, EAN-8
- Code 39
- UPC-A, UPC-E

---

### UI Components

Located in `resources/js/components/ui/`. These are shadcn/ui-based components.

| Component | Description | Usage |
|-----------|-------------|-------|
| `Alert` | Alert messages | `<Alert><AlertTitle>...</AlertTitle></Alert>` |
| `AlertDialog` | Confirmation dialogs | `<AlertDialog>...</AlertDialog>` |
| `Avatar` | User avatar display | `<Avatar><AvatarImage src="..." /></Avatar>` |
| `Badge` | Status badges | `<Badge variant="secondary">Label</Badge>` |
| `Breadcrumb` | Navigation breadcrumbs | `<Breadcrumb>...</Breadcrumb>` |
| `Button` | Buttons with variants | `<Button variant="outline">Click</Button>` |
| `Card` | Content cards | `<Card><CardHeader>...</CardHeader></Card>` |
| `Checkbox` | Checkbox input | `<Checkbox checked={...} onCheckedChange={...} />` |
| `Collapsible` | Collapsible sections | `<Collapsible>...</Collapsible>` |
| `Dialog` | Modal dialogs | `<Dialog><DialogTrigger>...</DialogTrigger></Dialog>` |
| `DropdownMenu` | Dropdown menus | `<DropdownMenu>...</DropdownMenu>` |
| `Input` | Text input field | `<Input placeholder="..." value={...} />` |
| `Label` | Form labels | `<Label htmlFor="input">Label</Label>` |
| `Select` | Select dropdown | `<Select>...</Select>` |
| `Separator` | Visual separator | `<Separator />` |
| `Sheet` | Slide-out panel | `<Sheet>...</Sheet>` |
| `Sidebar` | App sidebar | `<Sidebar>...</Sidebar>` |
| `Skeleton` | Loading placeholder | `<Skeleton className="h-4 w-full" />` |
| `Table` | Data tables | `<Table>...</Table>` |
| `Tabs` | Tabbed interface | `<Tabs><TabsList>...</TabsList></Tabs>` |
| `Textarea` | Multi-line input | `<Textarea placeholder="..." />` |
| `Toggle` | Toggle button | `<Toggle pressed={...}>...</Toggle>` |
| `Tooltip` | Hover tooltips | `<Tooltip><TooltipTrigger>...</TooltipTrigger></Tooltip>` |

---

### Layout Components

#### `AppLayout`

Main application layout wrapper.

**File:** `resources/js/layouts/app-layout.tsx`

**Usage:**
```tsx
import AppLayout from '@/layouts/app-layout';

function DashboardPage() {
  return (
    <AppLayout>
      <h1>Dashboard</h1>
    </AppLayout>
  );
}
```

#### `AuthLayout`

Authentication pages layout.

**File:** `resources/js/layouts/auth-layout.tsx`

**Usage:**
```tsx
import AuthLayout from '@/layouts/auth-layout';

function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
```

---

## Utility Functions

### localStorage Utilities

**File:** `resources/js/components/utils/localStorage.ts`

#### `saveToLocalStorage<T>(key: string, data: T): void`

Save data to localStorage with error handling.

```ts
import { saveToLocalStorage } from '@/components/utils/localStorage';

saveToLocalStorage('user-preferences', { theme: 'dark' });
```

#### `loadFromLocalStorage<T>(key: string, defaultValue: T): T`

Load data from localStorage with fallback to default value.

```ts
import { loadFromLocalStorage } from '@/components/utils/localStorage';

const prefs = loadFromLocalStorage('user-preferences', { theme: 'light' });
```

#### `removeFromLocalStorage(key: string): void`

Remove a single key from localStorage.

```ts
import { removeFromLocalStorage } from '@/components/utils/localStorage';

removeFromLocalStorage('temp-data');
```

#### `clearAllAppData(): void`

Clear all application-specific localStorage keys.

```ts
import { clearAllAppData } from '@/components/utils/localStorage';

clearAllAppData(); // Clears all twisting/weaving data
```

#### `restoreProblemsWithDates<T>(problems: any[]): T[]`

Restore Date objects from serialized problem arrays.

```ts
import { restoreProblemsWithDates } from '@/components/utils/localStorage';

const problems = restoreProblemsWithDates(savedProblems);
// problems[0].timestamp is now a Date object
```

---

### CSV Export Utilities

**File:** `resources/js/components/utils/csv-export.ts`

#### `exportTwistingDataToCSV(spindleData, formData, problems, filename?, saveToDatabase?): Promise<void>`

Export twisting tension data to CSV and optionally save to database.

```ts
import { exportTwistingDataToCSV } from '@/components/utils/csv-export';

await exportTwistingDataToCSV(
  spindleData,      // Record<number, SpindleData>
  formData,         // TwistingFormData
  problems,         // TwistingProblem[]
  'my-export',      // optional filename
  true              // save to database
);
```

#### `exportWeavingDataToCSV(creelData, formData, problems, filename?, saveToDatabase?): Promise<void>`

Export weaving tension data to CSV and optionally save to database.

```ts
import { exportWeavingDataToCSV } from '@/components/utils/csv-export';

await exportWeavingDataToCSV(
  creelData,        // CreelData
  formData,         // WeavingFormData
  problems,         // WeavingProblem[]
  'my-export',      // optional filename
  true              // save to database
);
```

---

### Database Connector

**File:** `resources/js/components/utils/databaseConnector.ts`

#### `LaravelDatabaseService` Class

Service class for Laravel API communication.

```ts
import { databaseService } from '@/components/utils/databaseConnector';

// Save a tension record
const result = await databaseService.saveTensionRecord(recordData);
if (result.success) {
  console.log('Saved with ID:', result.id);
}

// Get all records
const { records, pagination } = await databaseService.getTensionRecords('twisting', 1);

// Get single record
const record = await databaseService.getTensionRecord('123');

// Delete record
await databaseService.deleteTensionRecord('123');

// Update record
await databaseService.updateTensionRecord('123', { metadata: { operator: 'Jane' } });
```

#### `prepareTwistingDataForDatabase(): TensionRecord`

Prepare twisting data from localStorage for database storage.

```ts
import { prepareTwistingDataForDatabase } from '@/components/utils/databaseConnector';

const record = prepareTwistingDataForDatabase();
await databaseService.saveTensionRecord(record);
```

#### `prepareWeavingDataForDatabase(): TensionRecord`

Prepare weaving data from localStorage for database storage.

```ts
import { prepareWeavingDataForDatabase } from '@/components/utils/databaseConnector';

const record = prepareWeavingDataForDatabase();
await databaseService.saveTensionRecord(record);
```

---

## Custom Hooks

### `useTwoFactorAuth`

**File:** `resources/js/hooks/use-two-factor-auth.ts`

Hook for managing two-factor authentication setup and recovery codes.

```ts
import { useTwoFactorAuth, OTP_MAX_LENGTH } from '@/hooks/use-two-factor-auth';

function TwoFactorSetup() {
  const {
    qrCodeSvg,           // QR code SVG string
    manualSetupKey,      // Manual entry key
    recoveryCodesList,   // Array of recovery codes
    hasSetupData,        // Boolean: has QR + key
    errors,              // Array of error messages
    clearErrors,         // Clear all errors
    clearSetupData,      // Clear QR and key data
    fetchQrCode,         // Fetch QR code from server
    fetchSetupKey,       // Fetch manual key from server
    fetchSetupData,      // Fetch both QR and key
    fetchRecoveryCodes,  // Fetch recovery codes
  } = useTwoFactorAuth();

  useEffect(() => {
    fetchSetupData();
  }, []);

  return (
    <div>
      {qrCodeSvg && <div dangerouslySetInnerHTML={{ __html: qrCodeSvg }} />}
      {manualSetupKey && <code>{manualSetupKey}</code>}
    </div>
  );
}
```

### `useAppearance`

**File:** `resources/js/hooks/use-appearance.tsx`

Hook for managing application appearance/theme.

### `useMobile`

**File:** `resources/js/hooks/use-mobile.tsx`

Hook for detecting mobile viewport.

### `useClipboard`

**File:** `resources/js/hooks/use-clipboard.ts`

Hook for clipboard operations.

### `useInitials`

**File:** `resources/js/hooks/use-initials.tsx`

Hook for generating user initials from name.

### `useMobileNavigation`

**File:** `resources/js/hooks/use-mobile-navigation.ts`

Hook for mobile navigation state management.

---

## TypeScript Interfaces

**File:** `resources/js/types/index.d.ts`

### `Auth`

```ts
interface Auth {
  user: User;
}
```

### `User`

```ts
interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  email_verified_at: string | null;
  two_factor_enabled?: boolean;
  created_at: string;
  updated_at: string;
  account_holder: string;
  [key: string]: unknown;
}
```

### `BreadcrumbItem`

```ts
interface BreadcrumbItem {
  title: string;
  href: string;
}
```

### `NavGroup`

```ts
interface NavGroup {
  title: string;
  items: NavItem[];
}
```

### `NavItem`

```ts
interface NavItem {
  title: string;
  href: NonNullable<InertiaLinkProps['href']>;
  icon?: LucideIcon | null;
  isActive?: boolean;
}
```

### `SharedData`

```ts
interface SharedData {
  name: string;
  quote: { message: string; author: string };
  auth: Auth;
  sidebarOpen: boolean;
  [key: string]: unknown;
}
```

---

## CSRF Token Handling

For all POST, PUT, PATCH, and DELETE requests from the frontend, you need to include the CSRF token:

```ts
// Step 1: Get CSRF cookie
await fetch('/csrf-token', { credentials: 'include' });

// Step 2: Extract token from cookie
const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
const csrfToken = match ? decodeURIComponent(match[1]) : '';

// Step 3: Include in request headers
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-XSRF-TOKEN': csrfToken,
  },
  body: JSON.stringify(data),
  credentials: 'include',
});
```

---

## Error Handling

### API Error Responses

All API endpoints return consistent error responses:

**Validation Error (422):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "field_name": ["Error message"]
  }
}
```

**Not Found (404):**
```json
{
  "success": false,
  "message": "Resource not found"
}
```

**Server Error (500):**
```json
{
  "success": false,
  "message": "Failed to perform action: error details"
}
```

**Unauthorized (401):**
```json
{
  "message": "Unauthenticated."
}
```

---

## Rate Limiting

The following endpoints have rate limiting applied:

| Endpoint | Limit |
|----------|-------|
| Mobile API routes | 60 requests per minute |
| Password update | 6 requests per minute |
| Email verification | 6 requests per minute |

---

## Environment Configuration

Key environment variables:

```env
APP_NAME="Application Name"
APP_ENV=local
APP_KEY=base64:...
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=database_name
DB_USERNAME=username
DB_PASSWORD=password

SANCTUM_STATEFUL_DOMAINS=localhost,localhost:3000
SESSION_DOMAIN=localhost
```

---

*Documentation generated for version 1.0.0 - Last updated: December 2025*
