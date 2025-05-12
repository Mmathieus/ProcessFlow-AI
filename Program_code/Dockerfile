# Use Python 3.9 as base image
FROM python:3.9-slim

# Set working directory in the container
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code to the container
COPY . .

# Create directory for BPMN files
RUN mkdir -p bpmn_files

# Expose port 5000 for Flask app
EXPOSE 5000

# Define environment variable for Flask
ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["python", "app.py"]