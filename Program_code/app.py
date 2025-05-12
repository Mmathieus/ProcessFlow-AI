from flask import Flask, render_template, send_from_directory, request, flash
import os
import uuid
from dotenv import load_dotenv
import main
import re
import time

load_dotenv()

# Initialize Flask application with secret key from environment variables
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "default_secret_key")

# Path to BPMN files directory - temporary storage for generated diagrams
app.config['BPMN_FOLDER'] = 'bpmn_files'
os.makedirs(app.config['BPMN_FOLDER'], exist_ok=True)

# Path to system prompt file - contains instructions for the AI model
app.config['SYSTEM_PROMPT_FILE'] = 'system_prompt.txt'


def format_message_by_sentences(message):
    """
    Splits text into sentences and returns formatted text with newlines between sentences.
    Used for better readability of error messages.
    """
    # Clean text
    message = message.strip()
    
    # If text is empty, return empty string
    if not message:
        return ""
    
    # Find all sentences (text ending with .!? followed by space or end of text)
    sentences = re.findall(r'[^.!?]+[.!?](?:\s|$)', message)
    
    # If no sentences found using regex (maybe they don't have periods), split by other criteria
    if not sentences:
        # Try to split by paragraphs or commas
        if '\n' in message:
            sentences = [s.strip() for s in message.split('\n') if s.strip()]
        elif ',' in message:
            sentences = [s.strip() + ',' for s in message.split(',') if s.strip()]
        else:
            # If that doesn't work either, return the original text
            return message
    
    # Clean sentences
    sentences = [s.strip() for s in sentences]
    
    # Join sentences
    return "\n".join(sentences)

def read_file_contents(file):
    """Helper function to read uploaded file contents and decode as UTF-8."""
    try:
        return file.read().decode('utf-8')
    except UnicodeDecodeError:
        print("ERROR: Error reading file - UnicodeDecodeError")
        raise ValueError("Error reading file. Please check that it is a text file.")

def handle_file_upload(file_input, existing_text=''):
    """Process uploaded file and return its contents or keep existing text if no file."""
    if file_input and file_input.filename != '':
        print(f"INFO: Processing uploaded file: {file_input.filename}")
        return read_file_contents(file_input)
    return existing_text

def validate_tokens(max_tokens_raw):
    """Validate max_tokens parameter, ensuring minimum value of 1."""
    try:
        max_tokens = int(max_tokens_raw)
        # Ensure minimum value
        if max_tokens < 1:
            max_tokens = 1
    except (ValueError, TypeError):
        # If conversion to integer fails, use default value
        max_tokens = 10000
    
    return max_tokens


@app.route('/', methods=['GET', 'POST'])
def index():
    # Get list of available AI models from main.py
    available_models = main.get_available_models()
    
    if request.method == 'POST':
        print("INFO: POST request to generate diagram")
        
        # Get input mode (SIMPLE or STRUCTURED)
        input_mode = request.form.get('input_mode', 'SIMPLE')
        print(f"INFO: Input mode: {input_mode}")
        
        text_input = ''
        
        try:
            if input_mode == 'SIMPLE':
                # Process Simple input - just a plain text description
                simple_text = request.form.get('simple_text_input', '').strip()
                
                # Process file if uploaded, prioritizing it over text input
                try:
                    simple_text = handle_file_upload(request.files.get('file_input'), simple_text)
                except ValueError as e:
                    print(f"ERROR: {str(e)}")
                    flash(str(e), 'error')
                    return render_template('index.html', 
                                           input_mode=input_mode, 
                                           part_input_text=request.form.get('simple_text_input', ''),
                                           available_models=available_models)
                
                if not simple_text:
                    print("WARNING: Empty input")
                    flash('Please enter text or upload a file.', 'error')
                    return render_template('index.html', 
                                           input_mode=input_mode, 
                                           part_input_text=request.form.get('simple_text_input', ''),
                                           available_models=available_models)
                
                # Format for SIMPLE mode - just prefix with a label
                text_input = f"Process Description:\n{simple_text}"
                
            else:  # STRUCTURED mode
                # Process STRUCTURED input - has separate name and flow fields
                process_name = request.form.get('structured_name_input', '').strip()
                process_flow = request.form.get('structured_flow_input', '').strip()
                
                # Process file if uploaded, only replacing the flow content
                try:
                    process_flow = handle_file_upload(request.files.get('file_input'), process_flow)
                except ValueError as e:
                    print(f"ERROR: {str(e)}")
                    flash(str(e), 'error')
                    return render_template('index.html', 
                                           input_mode=input_mode,
                                           full_name_input=process_name,
                                           full_flow_input=process_flow,
                                           available_models=available_models)
                
                if not process_flow:
                    print("WARNING: Empty input")
                    flash('Please enter process flow.', 'error')
                    return render_template('index.html', 
                                           input_mode=input_mode,
                                           full_name_input=process_name,
                                           full_flow_input=process_flow,
                                           available_models=available_models)
                
                # Format for STRUCTURED mode - includes both name and flow with labels
                text_input = f"Process Name: {process_name}\n\n"
                text_input += f"Process Flow:\n{process_flow}"
            
            # Get the selected AI model
            selected_model = request.form.get('model_selection', '').strip() or main.DEFAULT_MODEL
            is_default = selected_model == main.DEFAULT_MODEL
            print(f"INFO: Model: {selected_model}" + (" (default)" if is_default else ""))
            
            # Get advanced generation options
            temperature = float(request.form.get('temperature', 0))
            max_tokens = validate_tokens(request.form.get('max_tokens', 4000))
            
            print(f"INFO: Parameters: temp={temperature}, max_tokens={max_tokens}")
            
            # Measure generation time for performance tracking
            start_time = time.time()
            
            # Start of BPMN generation process
            try:
                # Generate BPMN using the function from main.py
                print("INFO: Starting BPMN generation...")
                system_prompt_path = app.config['SYSTEM_PROMPT_FILE']
                bpmn_content, input_tokens, output_tokens, used_model = main.generate_bpmn_from_text(
                    text_input, 
                    system_prompt_file=system_prompt_path,
                    model=selected_model,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                
                # Calculate generation time (in seconds)
                generation_time = round(time.time() - start_time, 2)
                print(f"INFO: BPMN generated successfully in {generation_time}s")
                
                # Save BPMN to file with unique name using UUID
                bpmn_filename = f"{uuid.uuid4()}.bpmn"
                with open(os.path.join(app.config['BPMN_FOLDER'], bpmn_filename), 'w', encoding='utf-8') as f:
                    f.write(bpmn_content)
                
                print(f"INFO: Saved BPMN file: {bpmn_filename}")
                
                # Get chosen model name for display
                model_name = next((m["name"] for m in available_models if m["id"] == used_model), "Claude")
                
                # Template parameters common to both modes
                template_params = {
                    'bpmn_filename': bpmn_filename,
                    'input_mode': input_mode,
                    'available_models': available_models,
                    'selected_model': used_model,
                    'selected_model_name': model_name,
                    'input_tokens': input_tokens,
                    'output_tokens': output_tokens,
                    'generation_time': generation_time,
                    'temperature': temperature,
                    'max_tokens': max_tokens
                }

                # Calculate cost in USD based on token usage
                estimated_cost = main.calculate_cost(used_model, input_tokens, output_tokens)
                print(f"INFO: Estimated cost: ${estimated_cost:.6f}")

                # Add estimated cost to template parameters
                template_params['estimated_cost'] = estimated_cost
                
                # Add mode-specific parameters to preserve user input
                if input_mode == 'SIMPLE':
                    template_params['part_input_text'] = request.form.get('simple_text_input', '')
                else:
                    template_params['full_name_input'] = process_name
                    template_params['full_flow_input'] = process_flow
                
                return render_template('index.html', **template_params)
                                    
            except ValueError as e:
                generation_time = round(time.time() - start_time, 2)
                error_str = str(e)
                
                # Handle special error cases from main.py
                if "model_problem" in error_str:
                    problem_message = error_str.split(':')[1].strip()
                    formatted_message = format_message_by_sentences(problem_message)
                    flash(formatted_message, 'error')
                
                else:
                    print(f"ERROR: {error_str}")
                    flash(f'Error generating BPMN diagram: {error_str}', 'error')
                
                # Common template parameters for error state
                template_params = {
                    'input_mode': input_mode,
                    'available_models': available_models,
                    'selected_model': selected_model,
                    'generation_time': generation_time,
                    'max_tokens': max_tokens
                }
                
                # Add mode-specific parameters to preserve user input
                if input_mode == 'SIMPLE':
                    template_params['part_input_text'] = request.form.get('simple_text_input', '')
                else:
                    template_params['full_name_input'] = process_name
                    template_params['full_flow_input'] = process_flow
                
                return render_template('index.html', **template_params)
                
        except Exception as e:
            print(f"ERROR: Unexpected exception: {str(e)}")
            flash(f'Error generating BPMN diagram: {str(e)}', 'error')
            
            # Common template parameters for general error
            template_params = {
                'input_mode': input_mode,
                'available_models': available_models,
                'selected_model': request.form.get('model_selection', main.DEFAULT_MODEL)
            }
            
            # Add mode-specific parameters to preserve user input
            if input_mode == 'SIMPLE':
                template_params['part_input_text'] = request.form.get('simple_text_input', '')
            else:
                template_params['full_name_input'] = request.form.get('structured_name_input', '')
                template_params['full_flow_input'] = request.form.get('structured_flow_input', '')
            
            return render_template('index.html', **template_params)
    
    # GET request - use default model from Python on first load
    return render_template('index.html', input_mode="STRUCTURED", available_models=available_models, selected_model=main.DEFAULT_MODEL)


@app.route('/bpmn/<filename>')
def bpmn_file(filename):
    """Serve the BPMN file from the storage directory."""
    print(f"INFO: Loading BPMN file: {filename}")
    return send_from_directory(app.config['BPMN_FOLDER'], filename)

@app.route('/delete-bpmn/<filename>', methods=['POST'])
def delete_bpmn_file(filename):
    """Delete a BPMN file from the server after it's been loaded."""
    try:
        print(f"INFO: Deleting BPMN file: {filename}")
        file_path = os.path.join(app.config['BPMN_FOLDER'], filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            print("INFO: File deleted successfully")
            return {"success": True, "message": f"File {filename} deleted successfully"}, 200
        else:
            print("WARNING: File not found")
            return {"success": False, "message": f"File {filename} not found"}, 404
    except Exception as e:
        print(f"ERROR: Error deleting file: {str(e)}")
        return {"success": False, "message": f"Error: {str(e)}"}, 500

@app.route('/static/<path:filename>')
def static_files(filename):
    """Serve static files like CSS and JavaScript."""
    return send_from_directory('static', filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)