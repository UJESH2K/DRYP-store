# 👕 DR-YP: Your Style, Your Store 🛍️

<div align="center">
  <img src="https://img.shields.io/badge/React%20Native-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB">
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js">
</div>

**DR-YP** is a modern, mobile-first e-commerce application designed for fashion. It provides a seamless shopping experience for users and a powerful management platform for vendors.

---

## ✨ Features

### For Customers
-   **🔐 Authentication:** Secure user registration and login.
-   **🎨 Personalization:** Onboarding process to capture user style preferences (favorite colors, brands, styles).
-   **🛍️ Product Discovery:** Browse and search for products with filters for brand, category, and price.
-   **❤️ Wishlist:** Save favorite items for later.
-   **🛒 Shopping Cart:** Add products to a cart for purchase.
-   **👤 Profile Management:** View and manage personal information.

### For Vendors
-   **📦 Product Management:** Create, update, and delete products.
-   **🔍 Search & Filter:** Easily find and manage products through a searchable interface.
-   **🏪 Store Profile:** Manage store details, including name, description, and contact information.

---



## 🛠️ Tech Stack

| Category      | Technologies                               |
| ------------- | ------------------------------------------ |
| **Frontend**  | React Native, Expo, Zustand, NativeWind    |
| **Backend**   | Node.js, Express.js                        |
| **Database**  | MongoDB (with Mongoose)                    |
| **API Layer** | REST API                                   |
| **Auth**      | JWT (JSON Web Tokens)                      |

---

## 📂 Project Structure

The project is a monorepo containing three main directories:
-   `./frontend/`: The React Native/Expo mobile application for customers and vendors.
-   `./backend/`: The Node.js/Express.js server that provides the REST API.
-   `./website/`: A Next.js-based marketing and landing page for the project.

---

## ⚙️ Getting Started

### Prerequisites
-   Node.js (v18 or later recommended)
-   npm
-   MongoDB instance (local or cloud-based like MongoDB Atlas)
-   Expo Go app on your mobile device for testing.

### 1. Environment Setup
You will need to create a `.env` file in both the `frontend` and `backend` directories.

**Backend `.env` file (`/backend/.env`):**
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
```
> **Note on MongoDB Atlas:** If you are using MongoDB Atlas, make sure to whitelist your IP address to allow connections from your machine.

**Frontend `.env` file (`/frontend/.env`):**
`EXPO_PUBLIC_API_BASE_URL=http://<your_local_ip_address>:5000`

> *Do not use `localhost` if you are running the app on your mobile device via Expo Go.*

### 2. Backend Setup

1.  Navigate to the backend directory: `cd backend`
2.  Install dependencies: `npm install`
3.  Start the server: `npm start`
    (The server will run on `http://localhost:5000`)

### 3. Frontend Setup

1.  Navigate to the frontend directory: `cd frontend`
2.  Install dependencies: `npm install`
3.  Start the Metro bundler: `npx expo start`
4.  Scan the QR code with the Expo Go app on your iOS or Android device.

### 4. Website Setup

1.  Navigate to the website directory: `cd website`
2.  Install dependencies: `npm install`
3.  Start the development server: `npm run dev`
    (The website will be available at `http://localhost:3000`)

---

## 🚀 Roadmap

Here are some features and improvements planned for the future:

-   [ ] **Checkout & Payment:** Full implementation of the checkout process.
-   [ ] **Order History:** A dedicated screen for users to view their past orders.
-   [ ] **Admin Dashboard:** A web-based interface for administrators to manage users, vendors, and products.
-   [ ] **Push Notifications:** For order status updates and promotional messages.
-   [ ] **Advanced Product Recommendations:** A more sophisticated recommendation engine.

---

This project is under active development. New features and improvements are being added regularly.
