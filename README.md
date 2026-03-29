<div align="center">
  <h1>🌍 Platform Migratory API</h1>
  <p><b>Streamlining legal immigration processes through AI-powered document validation and seamless Google Workspace integration.</b></p>

  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
  <a href="https://expressjs.com/">
    <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge" alt="Express" />
  </a>
  <a href="https://www.prisma.io/">
    <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
  </a>
  <a href="https://cloud.google.com/">
    <img src="https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white" alt="Google Cloud" />
  </a>
  <a href="https://www.docker.com/">
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  </a>
</div>

---

## 📖 Table of Contents

* [✨ Features](#-features)
* [🏗️ Architecture & AI Flow](#️-architecture--ai-flow)
* [📂 Folder Structure](#-folder-structure)
* [🚀 Getting Started](#-getting-started)

  * [Prerequisites](#prerequisites)
  * [Installation](#installation)
  * [Environment Variables](#environment-variables)
  * [Database Setup (Prisma)](#database-setup-prisma)
* [🛠️ Running the Application](#️-running-the-application)
* [🐳 Deployment (Docker & GCP)](#-deployment-docker--gcp)
* [🤝 Contributing](#-contributing)
* [📄 License](#-license)

---

## ✨ Features

* **Dual-Role Authentication:** Secure access control tailored for both `Clients` (applicants) and `Lawyers` (administrators).
* **AI Document Validation:** Automated data extraction and validation using Google Vision API and Gemini AI.
* **Automated Storage Pipeline:** Direct integration with Google Drive for secure document storage.
* **Real-time Syncing:** Live synchronization of client statuses and validations to Google Sheets.
* **Family Nucleus Management:** Grouping and managing interconnected migratory applications.

---

## 🏗️ Architecture & AI Flow

The platform relies on a robust layer-based architecture (Routes -> Controllers -> Services). Our core innovation lies in the automated document processing pipeline:

```mermaid
graph LR
    A[Client Uploads Doc <br/>(Multer)] --> B[AI Processing <br/>(Vision/Gemini extracts data)]
    B --> C[Cloud Storage <br/>(Upload to Google Drive)]
    C --> D[Data Sync <br/>(Update Google Sheets)]
    D --> E[Persistence <br/>(Save to DB via Prisma)]
```

Upload: A client uploads an identity or legal document.

AI Processing: visionService and geminiService analyze the document, validating its authenticity and extracting key migratory data.

Storage: The file is securely uploaded to Google Drive via driveService.

Sync: Key metadata and validation statuses are logged into Google Sheets (ClientSheetsService, ValidationSheetsService) for legal review.

Persistence: The final state and URLs are saved in our relational database using Prisma.

---

## 📂 Folder Structure

```plaintext
platform-migratory-backend/
├── prisma/                  # Database schema and migrations
├── src/
│   ├── config/              # App configuration (Google APIs, Prisma client)
│   ├── controllers/         # Request handlers (Auth, Client, Lawyer, Documents)
│   ├── middleware/          # Express middlewares (Auth, Roles, Error handling)
│   ├── models/              # TypeScript interfaces/types
│   ├── routes/              # API Route definitions
│   ├── services/            # Core business logic
│   │   ├── ai/              # Gemini and Vision integrations
│   │   ├── googleDrive/     # Drive API handlers & webhooks
│   │   └── googleSheets/    # Sheet synchronization repositories
│   ├── utils/               # Helpers (AppError, asyncHandler)
│   ├── app.ts               # Express app setup
│   └── index.ts             # Server entry point
├── tests/                   # Jest test suites
├── Dockerfile               # Container configuration
└── .env.example             # Environment variables template
```

---

## 🚀 Getting Started

### Prerequisites

* Node.js (v18 or higher)
* Docker & Docker Compose (optional, for local DB/deployment)
* MySQL Database
* Google Cloud Console Project (with Drive, Sheets, and Vision APIs enabled)

### Installation

Clone the repository:

```bash
git clone [https://github.com/Jonathanrbt/platform-migratory-backend.git](https://github.com/Jonathanrbt/platform-migratory-backend.git)
cd platform-migratory-backend
```

Install dependencies:

```bash
npm install
```

### Environment Variables

Copy the example environment file and fill in your details:

```bash
cp .env.example .env
```
Open the `.env` file and configure the following main blocks (you can find all the configuration details in `.env.example`):

- **Authentication:** Generate a secure `JWT_SECRET`.
- **Google Cloud Service Account:** You will need `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`, and `GOOGLE_PRIVATE_KEY` (remember to keep the `\n` line breaks inside the quotes).
- **OAuth 2.0:** Configure the `GOOGLE_CLIENT_ID`, `SECRET`, and the `REFRESH_TOKEN` (generated from OAuth Playground) for Drive persistence.
- **Database:** Define your `DATABASE_URL` for Prisma.

Make sure to configure your Google Service Account credentials, Prisma `DATABASE_URL`, and your `GEMINI_API_KEY` inside the `.env` file.

### Database Setup (Prisma)

We use Prisma ORM to manage our database schema. Run the following commands to get your database ready:

```bash
# Generate the Prisma Client based on your schema
npx prisma generate

# Push the schema state to the database (Ideal for prototyping)
npx prisma db push

# OR: Apply migrations to your development database (Standard)
npx prisma migrate dev --name init
```
---

## 🛠️ Administrative Tasks

### Create a "Lawyer" User (Administrator)
To manage the system, validate documents, and assist clients, you need an account with a "lawyer" role. Due to security measures, these users cannot be registered through the public interface.

Use the dedicated script to generate this profile from the terminal:

\`\`\`bash
npx ts-node src/scripts/create_lawyer.ts
\`\`\`

The script will guide you through the process or generate the necessary credentials in the database so you can log in immediately to the administrative dashboard.

Modify the lawyer script to add your own credentials.

---

## 🛠️ Running the Application

Development Mode:

```bash
npm run dev
```

Production Build:

```bash
npm run build
npm start
```

---


## 🤝 Contributing

We care about code quality and consistency! We use Husky, lint-staged, ESLint, and Prettier to maintain our standards.

Branching Strategy: Create a feature branch from main: git checkout -b feature/your-feature-name

Conventional Commits: We enforce Conventional Commits. Your commit messages should look like:

```text
feat: add new gemini extraction service

fix: resolve memory leak in multer upload

docs: update setup instructions
```

Pre-commit Hooks: When you run git commit, Husky will automatically trigger lint-staged to format your code with Prettier and check for errors with ESLint. If the linting fails, the commit will be aborted.

Push & PR: Push your branch and open a Pull Request describing your changes.

```bash
# To manually run the linter and formatter before committing:
npm run lint
npm run format
```

---

## 📄 License

This project is proprietary and confidential. Unauthorized copying of these files, via any medium, is strictly prohibited.

<p align="center">Made with ❤️ for a better migratory experience.</p>
