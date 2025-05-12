# ProcessFlow AI

ProcessFlow AI is a web application that transforms textual descriptions of processes into BPMN (Business Process Model and Notation) diagrams using artificial intelligence. The application leverages the Anthropic API for generating BPMN code and the bpmn.js library for visualizing and editing diagrams in the browser.

## Prerequisites

- **Anthropic API Key**: You'll need a valid API key from Anthropic to use the AI model
- For standard installation:
  - Python 3.12.8 (version we used)
  - Flask and other dependencies listed in requirements.txt
- For Docker installation:
  - Docker
  - Docker Compose

## Project Structure

The application has the following structure:

```
ProcessFlow-AI/
├── app.py                # Main Flask web server
├── main.py               # Logic for generating BPMN using Anthropic API
├── system_prompt.txt     # System prompt for the AI model
├── bpmn_files/           # Directory for temporary BPMN file storage
├── static/               # Static files for the web application
│   ├── css/              # CSS styles
│   │   └── styles.css    # Main CSS file
│   ├── js/               # JavaScript files
│   │   └── main.js       # Main client-side JavaScript
│   └── favicon.png       # Application favicon
├── templates/            # HTML templates
│   └── index.html        # Main application page
├── Dockerfile            # Docker container definition
├── docker-compose.yml    # Docker Compose configuration
├── requirements.txt      # Python dependencies
└── .env                  # Environment variables file (API key)
```

## File Description

### Main Application Files

- **app.py**: Main Flask application server that handles HTTP requests, renders templates, and manages the interface between the user and BPMN generation.
- **main.py**: Contains the core logic for communicating with the Anthropic API, generating and validating BPMN code.
- **system_prompt.txt**: Contains system instructions for the AI model that define how to generate BPMN diagrams.

### Frontend

- **templates/index.html**: Main HTML template with responsive design that contains a form for text input and display of the generated BPMN diagram.
- **static/css/styles.css**: CSS styles for the application.
- **static/js/main.js**: Client-side JavaScript code that handles user interactions, form processing, and BPMN diagram visualization.

### Docker Configuration

- **Dockerfile**: Defines the environment for running the application, including dependency installation.
- **docker-compose.yml**: Configuration for running the container, defines ports, volumes, and environment variables.
- **requirements.txt**: List of Python libraries required for the application.

## How the Program Works

1. The user enters a textual description of a process into a form on the web page.
2. The application sends this text to the Anthropic API (Claude) with a prepared system prompt.
3. The AI model generates BPMN XML code according to the provided description.
4. The application processes and validates the generated BPMN code.
5. The code is temporarily stored on the server and displayed to the user using the bpmn.js visualization tool.
6. The user can view, edit, and save the resulting diagram.

## Input Modes

The application supports two modes of process input:

1. **Simple Mode**: The user enters the entire process description in a single text field.
2. **Structured Mode**: The user enters the process name and process steps separately.

## Running the Application

### Setting up the environment

1. Create a `.env` file in the root directory of the project with the following content:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   SECRET_KEY=your_secret_key_for_flask
   ```

### Standard Installation

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python app.py
   ```

3. Open a browser and navigate to http://localhost:5000

### Docker Installation

1. Start the application using Docker Compose:
   ```bash
   docker-compose up
   ```

2. Open a browser and navigate to http://localhost:5000

#### Running in the Background

To run the application in the background:
```bash
docker-compose up -d
```

#### Stopping the Application

```bash
docker-compose down
```

## Using the Application

1. Select the input mode (Simple or Structured).
2. Enter the textual description of the process.
3. Optionally, you can upload a text file (.txt) with the process description.
4. Select an AI model from the available options (Claude Sonnet 3.7, Claude Opus 3, etc.).
5. Optionally adjust advanced settings (temperature, maximum number of tokens).
6. Click the "Generate BPMN" button.
7. After processing, the generated BPMN diagram will be displayed.
8. You can view, edit, and save the diagram in .bpmn format.

## Extending the Project

You can extend or modify the project by:

- Adding support for additional AI models
- Modifying the system prompt for specific BPMN styles
- Enhancing the user interface
- Adding features for team collaboration
- Implementing advanced BPMN validations

## Known Limitations

- BPMN diagram generation depends on the quality of the input text.
- For complex processes, it may be necessary to increase the maximum token limit.
- An Anthropic API key is required for the application to function.
