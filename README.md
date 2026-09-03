# Subscription Billing & SaaS Platform Backend

A robust, corporate-quality Node.js backend designed for managing complex SaaS subscription plans, usage metering, and lifecycle billing logic. This project provides a fully functional MVC-based REST API capable of powering a modern SaaS business.

---

## 🏗 System Architecture

This project is built using the **Model-View-Controller (MVC)** architectural pattern, strictly separating database schemas (Models), business logic (Controllers), and API endpoint definitions (Routes).

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose ORM)
- **Security**: JWT (JSON Web Tokens), bcrypt (password hashing), Helmet, express-rate-limit.
- **Validation**: Joi (strict request payload validation).
- **Testing**: Jest & Supertest.

---

## 🗄️ Database Schemas & Relationships

The platform relies on a heavily relational MongoDB structure to maintain data integrity across billing cycles:

1. **User (`User.js`)**: Differentiated by roles (`admin` vs `customer`). 
2. **Plan (`Plan.js`)**: Defines pricing tiers (e.g., Basic, Pro, Enterprise) and billing cycles (monthly/yearly).
3. **Subscription (`Subscription.js`)**: The core entity connecting a Customer to a Plan. Tracks the state machine (`active`, `past_due`, `canceled`, `grace_period`) and proration credits.
4. **UsageRecord (`UsageRecord.js`)**: Tracks metered usage for a subscription (e.g., `api_calls`, `storage_gb`).
5. **Invoice (`Invoice.js`)**: Automatically generated bills consisting of line items (base plan cost + usage overages - discounts). Tracks payment attempts and retry dunning logic.
6. **Coupon (`Coupon.js`)**: Supports `percentage` or `fixed` discounts, redeemable against specific plans.
7. **AuditLog (`AuditLog.js`)**: Immutable tracking of critical state changes (e.g., plan upgrades, cancellations).

---

## ⚙️ Core Business Logic Deep Dive

### 1. Subscription Lifecycle & Proration
When a customer upgrades or downgrades their plan in the middle of a billing cycle, the system calculates the remaining time on their current plan, generates a "Proration Credit," and applies it directly to the `Subscription` model. The next invoice automatically deducts this credit from the subtotal.

### 2. Automated Invoice Generation
The `generateInvoice` controller performs complex aggregation:
- It fetches the base price of the active plan.
- It queries all unrecorded `UsageRecord` documents, multiplying quantity by unit price, and appends them as line items.
- It applies existing proration credits.
- It validates and applies Coupon discounts.
- Finally, it sums the line items, clamps the total to 0 to prevent negative invoices, and locks the usage records as 'recorded'.

### 3. Dunning & Payment Retries
If an invoice payment fails, the system increments the `failedPaymentCount`. A Dunning engine dictates retry limits (e.g., failing 3 times moves the subscription into a `past_due` or `canceled` state).

---

## 🚀 Local Setup & Testing

### 1. Requirements & Bootstrapping
You will need Node.js and Docker installed.
```bash
# 1. Start the local MongoDB database
docker compose up -d

# 2. Install Dependencies
npm install

# 3. Seed the Database with Demo Data
# (Creates Admin, Customers, Plans, Subscriptions, and Invoices)
npm run seed
```

### 2. Starting the Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

### 3. Running Automated Tests
The platform includes 55 rigorous unit tests covering every single controller and RBAC edge-case. To run them:
```bash
# Seeds the database and runs the full test suite
npm run verify
```

### 4. Interactive Testing (Swagger UI)
You can manually test all endpoints by visiting the generated Swagger Docs:
**[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

### 5. Visual End-to-End Testing Dashboard
To verify the entire platform lifecycle visually, open:
**[http://localhost:3000](http://localhost:3000)**
This provides a 1-click testing interface that registers users, creates subscriptions, records usage, generates invoices, and pays them dynamically in real-time.

---

## 🛠 How to Modify and Extend the Project

This API is designed to be highly modular. If you need to add new features, follow the MVC structure:

### Adding a New API Endpoint
1. **Model**: If it requires new data, create or modify a schema in `/models/`.
2. **Validator**: Add a Joi schema to `/utils/validators.js` to protect the route.
3. **Controller**: Write your business logic in `/controllers/`. Use the existing `asyncHandler` wrapper to automatically catch errors.
4. **Route**: Map your controller to a URL in `/routes/`. Protect it with `auth` and `rbac('admin')` middleware if necessary.
5. **Swagger**: Add the standard JSDoc YAML above the route definition so it auto-populates in the UI.

### Integrating a Real Payment Gateway (Stripe/Razorpay)
Currently, `PUT /api/invoices/:id/pay` simulates a payment gateway. To integrate a real one:
1. Update `invoiceController.js` inside the `payInvoice` function.
2. Initialize a Stripe Intent or Razorpay Order.
3. Create a new route (e.g., `/api/webhooks/stripe`) to listen for async payment confirmations and update the Invoice status to `paid`.

### Adding CRON Jobs
For a true production environment, invoices should be generated automatically at the end of a billing cycle. You can install `node-cron` and create a `worker.js` file that queries all Subscriptions where `endDate <= Date.now()` and calls the `generateInvoice` service.

---

## 🌍 Deployment

To deploy this backend application, you will need a platform that supports Node.js (such as Render, Heroku, Railway, or AWS). It cannot be deployed to static hosts like GitHub Pages.

**Deploying to Render (Recommended Free Option):**
1. Connect this repository to your [Render](https://render.com/) account.
2. The included `render.yaml` Blueprint will automatically configure the web service.
3. Add a `MONGODB_URI` environment variable in the Render dashboard (e.g., using a free cluster from MongoDB Atlas).
4. The service will build, install dependencies, and start automatically.
