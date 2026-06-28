# Library Management System — Backend

A RESTful API powering a full-stack Library Management System, built with Node.js, Express, and MySQL. Supports JWT-based authentication, role-based access control, and complete book/member/borrowing lifecycle management.

**Frontend repo:** [library-management-frontend](https://github.com/aakash2005-code-it/library-management-frontend)

---

## Features

- **JWT Authentication** — secure signup/login with bcrypt password hashing
- **Role-based access control** — separate Admin and Member permissions
- **Book management** — add, search/filter, and view detailed book stats
- **Borrow & Return system** — automatic availability tracking
- **Fines tracking** — per-member fine calculation
- **Overdue detection** — flags books past their due date
- **Borrowing history** — full transaction history per member
- **Member profiles** — aggregated stats per member (borrows, fines, activity)
- **Dashboard stats** — live counts for books, members, active loans, and fines

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MySQL |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Driver | mysql2 |
| Env config | dotenv |

---

## Database Schema

- **books** — title, author, genre, total/available copies
- **members** — name, email, hashed password, role, phone
- **admins** — name, email, hashed password
- **borrowing_records** — book_id, member_id, borrow/due/return dates
- **fines** — record_id, member_id, fine_amount, paid status

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/signup` | Register a new member | Public |
| POST | `/login` | Login (member or admin) | Public |
| GET | `/books` | List/search books | Public |
| GET | `/books/:id` | Book details + borrow stats | Public |
| POST | `/books` | Add a new book | Admin |
| POST | `/members` | Add a new member | Admin |
| GET | `/members/:id` | Member profile + history | Public |
| POST | `/borrow` | Borrow a book | Public |
| PUT | `/return` | Return a book | Public |
| GET | `/fines/:memberId` | Check member fines | Public |
| GET | `/history/:memberId` | Borrowing history | Public |
| GET | `/overdue` | List overdue books | Public |
| GET | `/stats` | Dashboard statistics | Public |

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- MySQL Server

### Installation

```bash
git clone https://github.com/aakash2005-code-it/library-management-backend.git
cd library-management-backend
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=library_db
PORT=5000
JWT_SECRET=your_secret_key
```

### Run

```bash
npm run dev
```

Server runs on `http://localhost:5000`

---

## Author

**Aakash Wadhwani**
B.Tech IT, Vellore Institute of Technology
[LinkedIn](https://www.linkedin.com/in/aakash-wadhwani-273351320) · [LeetCode](https://leetcode.com/u/aakashwadhwani2005/)

