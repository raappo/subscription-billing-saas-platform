# Subscription Billing & SaaS Platform Backend

A robust Node.js backend for managing SaaS subscription plans, usage metering, and billing logic. This project implements a fully functional MVC-based REST API designed for the "Advanced JavaScript Backend Frameworks" CIA-3 assignment.

## Features & Modules

This project fulfills all 13 required modules for Project 17:
1. **User Registration & Authentication**: Secure JWT-based authentication with bcrypt password hashing.
2. **Subscription Plan Management**: Admin-only endpoints to create and manage pricing tiers.
3. **Subscription Creation Workflow**: Customer endpoints to subscribe to plans.
4. **Plan Upgrade/Downgrade Logic**: Automatic proration credit calculations for plan changes.
5. **Usage Metering Records**: API for recording and tracking metric-based usage.
6. **Invoice Generation Engine**: Automated generation of invoices combining base plan costs and overages.
7. **Payment Status Tracking**: Endpoints to track and mark invoices as paid.
8. **Subscription Cancellation & Grace Period**: Lifecycle logic for cancellations and grace periods.
9. **Coupon/Discount Application**: Admin management of percentage and fixed discount coupons.
10. **Customer Billing Dashboard**: Aggregated views for customers to see active plans, history, and usage.
11. **Dunning/Failed Payment Workflow**: Retry logic for failed invoice payments.
12. **Admin Revenue Reports**: Deep analytics on MRR, churn rate, and plan-wise breakdowns.
13. **Role-Based Access Control (RBAC)**: Strict separation of privileges between `admin` and `customer` roles.

## Tech Stack

- **Framework**: Node.js + Express.js
- **Database**: MongoDB + Mongoose
- **Validation**: Joi
- **Security**: Helmet, CORS, Express Rate Limit, bcrypt, jsonwebtoken
- **Testing**: Jest + Supertest
- **Documentation**: Swagger UI / OpenAPI

## Local Setup & Testing

### 1. Start MongoDB
You can use Docker to spin up a local MongoDB instance quickly:
```bash
docker compose up -d
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Seed the Database
Populate the database with a robust set of demo data (admins, customers, plans, active/past_due subscriptions, coupons, and usage):
```bash
npm run seed
```
*(The seed script will print the generated demo credentials to the console).*

### 4. Run the Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

### 5. Explore the API Documentation (Swagger)
Open your browser and navigate to the Swagger UI to see all available endpoints and test them directly:
**[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

### 6. Run Automated Tests
Execute the comprehensive API test suite covering all 13 modules (55 tests):
```bash
npm test
```

## Deployment

To deploy this backend application, you will need a platform that supports Node.js applications (such as Render, Heroku, or AWS). It cannot be deployed to static hosts like GitHub Pages.

**Deploying to Render (Recommended Free Option):**
1. Connect this repository to your [Render](https://render.com/) account.
2. The included `render.yaml` Blueprint will automatically configure the web service.
3. Add a `MONGODB_URI` environment variable in the Render dashboard (e.g., using a free cluster from MongoDB Atlas).
4. The service will build and start automatically.
