# Study Buddy 📚

Study Buddy is an AI-powered study assistant that helps students learn from their own notes. It provides quiz generation, flashcards, and document-based question answering through a web interface.

## Features

- **AI Quiz Generation** — Generate quizzes from your study material.
- **Flashcards** — Create flashcards to review important concepts.
- **Ask Notes** — Ask questions about your uploaded study material.
- **PDF Upload** — Upload PDF notes to use as study material.
- **Progress Dashboard** — Track study progress, with progress data saved in browser local storage.
- **Retrieval-Based Context** — Retrieve relevant text chunks to help provide context for questions.
- **Automated Tests** — Test the text-processing and retrieval functions.

## Tech Stack

- JavaScript (ES Modules)
- Node.js
- Express.js
- Google Gemini API
- HTML and CSS
- Node.js built-in test runner

## Prerequisites

- Node.js 20 or later
- npm
- A Google Gemini API key

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/mandeepheir/study-buddy.git
cd study-buddy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure your API key

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your own Gemini API key. Never commit your actual API key to GitHub.

### 4. Start the application

```bash
npm start
```

Open the local address shown by your server in your browser. If the server uses port 3000, visit `http://localhost:3000`.

## Run Tests

Run the automated tests with:

```bash
npm test
```

## Project Structure

```text
study-buddy/
├── public/
│   └── index.html
├── tests/
│   └── retrieval.test.js
├── Errors.js
├── Limiter.js
├── retrieval.js
├── server.js
├── package.json
└── README.md
```

## What I Learned

- Building a web application with Node.js and Express.
- Integrating an AI API into a web application.
- Processing text and retrieving relevant content from study notes.
- Writing automated tests with Node.js.
- Managing project changes with Git and GitHub.

## Future Improvements

- Improve the user interface and accessibility.
- Add more comprehensive automated tests.
- Deploy the application for public access.
- Expand study analytics and revision features.

## Author

**Mandeep Heir**

GitHub: [@mandeepheir](https://github.com/mandeepheir)
