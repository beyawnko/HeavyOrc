# Gemini Heavy Orchestrator

![Gemini Heavy Orchestrator Banner](./assets/banner.png)

An advanced web application that demonstrates a 'Mixture-of-Experts' orchestration pattern using the Gemini API. It spawns multiple AI agents in parallel to generate draft responses, then uses a final arbiter agent to synthesize the best possible answer from the drafts, streaming the result back to the user.

## Features

*   **Multi-Agent Orchestration**: Spawns a configurable number of "expert" AI agents.
*   **Response Synthesis**: Uses a final "arbiter" agent to combine the best parts of all drafts.
*   **Streaming UI**: Streams the final, synthesized answer back to the user in real-time.
*   **Progress Visualization**: A live progress bar shows the status of the agent and arbiter phases.
*   **Responsive Gallery View**: Displays the final answer and all contributing drafts in an animated, easy-to-read gallery.

## Prerequisites

*   **A modern web browser.**
*   **Google Gemini API Key**: You need an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Getting Started

1.  **Set up your API Key:**
    *   The application requires your Google Gemini API key to be available as an environment variable named `API_KEY`.
    *   Please consult the documentation for your specific development environment on how to configure secrets or environment variables.

2.  **Run the application:**
    *   Once the `API_KEY` is configured, the application should run directly. No local installation or build steps are required.
