import os
import logging
from dotenv import load_dotenv
from anthropic import Anthropic, AnthropicError

load_dotenv()

# Simple logger access
logger = logging.getLogger(__name__)

# Available AI models definition with pricing information
AVAILABLE_MODELS = [
    {
        "id": "claude-3-7-sonnet-20250219", 
        "name": "Sonnet 3.7",
        "pricing": {
            "input": 0.000003,  # $ per token for input text
            "output": 0.000015  # $ per token for output generation
        }
    },
    {
        "id": "claude-3-opus-20240229", 
        "name": "Opus 3",
        "pricing": {
            "input": 0.000015,
            "output": 0.000075
        }
    },
    {
        "id": "claude-3-5-sonnet-20241022", 
        "name": "Sonnet 3.5",
        "pricing": {
            "input": 0.000003,
            "output": 0.000015
        }
    },
    {
        "id": "claude-3-5-haiku-20241022", 
        "name": "Haiku 3.5",
        "pricing": {
            "input": 0.0000008,
            "output": 0.000004
        }
    },
]

# Default model (first in list)
DEFAULT_MODEL = AVAILABLE_MODELS[0]["id"]

def get_available_models():
    """Return models for UI display"""
    return AVAILABLE_MODELS

def calculate_cost(model_id, input_tokens, output_tokens):
    """
    Calculate the cost of API usage based on token counts in USD.
    Uses the pricing information from the model definitions.
    """
    # Find the model in AVAILABLE_MODELS
    model_info = next((model for model in AVAILABLE_MODELS if model["id"] == model_id), None)
    
    # If model not found, use default pricing (Sonnet 3.7)
    if not model_info:
        pricing = AVAILABLE_MODELS[0]["pricing"]
    else:
        pricing = model_info["pricing"]
    
    # Calculate costs in USD
    input_cost_usd = input_tokens * pricing["input"]
    output_cost_usd = output_tokens * pricing["output"]
    total_cost_usd = input_cost_usd + output_cost_usd
    
    return total_cost_usd

def init_client():
    """
    Initialize the Anthropic client with API key from environment variables.
    Raises an error if the API key is not set.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: Missing API key")
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
    return Anthropic(api_key=api_key)

def load_system_prompt(system_prompt_file):
    """
    Load system prompt from file if available.
    The system prompt contains instructions for the AI model on how to generate BPMN.
    """
    system_prompt = None
    if system_prompt_file:
        try:
            if os.path.exists(system_prompt_file):
                with open(system_prompt_file, 'r', encoding='utf-8') as f:
                    system_prompt = f.read()
                print("INFO: System prompt loaded")
            else:
                print(f"WARNING: System prompt file not found: {system_prompt_file}")
        except Exception as e:
            print(f"ERROR: Error loading system prompt: {str(e)}")
    return system_prompt

def validate_bpmn_content(content, model):
    """
    Validate BPMN content and check for common issues.
    Ensures the generated XML is complete and handles error cases.
    """
    content = content.strip()

    # print(50*'=')
    # print("BPMN CONTENT RECEIVED:")
    # print(content)
    # print(50*'=')
    
    # CASE 1: Detect "PROBLÉM" message - model can't create diagram
    if "PROBLÉM" in content:
        problem_msg = "The selected AI model could not create the process model. We recommend switch to better available AI model or to specify process flow."
        print(f"ERROR: {problem_msg}")
        raise ValueError(f"model_problem:{problem_msg}")
    
    # CASE 2: Diagram is not complete
    if '</bpmn:definitions>' not in content and '</definitions>' not in content:
        problem_msg = "Due to the low amount of 'Max Tokens' selected AI model cold not create process model. We recommend to increse the 'Max Tokens' limit."
        print(f"ERROR: {problem_msg}")
        raise ValueError(f"model_problem:{problem_msg}")
    
    # ONLY BPMN code allowed
    # Extract content from XML declaration to end of definitions
    xml_start = content.find('<?xml version="1.0" encoding="UTF-8"?>')
    
    # Find the end tag - could be either </bpmn:definitions> or </definitions>
    if '</bpmn:definitions>' in content:
        xml_end = content.find('</bpmn:definitions>') + len('</bpmn:definitions>')
    else:
        xml_end = content.find('</definitions>') + len('</definitions>')
    
    # Extract only the BPMN XML content
    content = content[xml_start:xml_end]

    print(50*'=')
    print("VALIDATED BPMN CONTENT:")
    print(content)
    print(50*'=')
    
    return content

def generate_bpmn_from_text(text, system_prompt_file=None, model=None, temperature=0, max_tokens=10000):
    """
    Generate BPMN diagram from text description using Claude API.
    
    Args:
        text: The process description text input
        system_prompt_file: Path to the system prompt file
        model: The AI model ID to use
        temperature: Creativity setting (0-1)
        max_tokens: Maximum output tokens allowed
        
    Returns:
        Tuple of (bpmn_content, input_tokens, output_tokens, model_used)
    """
    # Use default model if none specified
    if not model:
        model = DEFAULT_MODEL
    
    print(f"INFO: Generating with model: {model}")
    client = init_client()
    
    # Load system prompt
    system_prompt = load_system_prompt(system_prompt_file)
    
    # Construct the prompt
    prompt = f""" {text} """
    
    # Create the message with system prompt if available
    messages = [{"role": "user", "content": prompt}]
    
    try:
        # Make the API call
        print("INFO: Calling Anthropic API...")
        print(f"INFO: Using temperature={temperature}, max_tokens={max_tokens}")
        
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=messages
        )
        
        # Extract content from response
        content = response.content[0].text
        print(f"INFO: Response received: input_tokens={response.usage.input_tokens}, output_tokens={response.usage.output_tokens}")
        
        # Validate the BPMN content
        validated_content = validate_bpmn_content(content, model)
        
        return validated_content, response.usage.input_tokens, response.usage.output_tokens, model
    
    except AnthropicError as e:
        print(f"ERROR: API error: {str(e)}")
        error_str = str(e).lower()
        
        # Check for overloaded error (error code 529)
        if '529' in error_str and 'overloaded_error' in error_str:
            print("ERROR: Anthropic API is currently overloaded. Please try again in a few minutes.")
            raise ValueError(f"model_problem:The Anthropic API is currently overloaded. Please try again in a few minutes or consider using a different model.")
        
        # Incorrect model name
        if '404' in error_str and 'not_found_error' in error_str and 'model:' in error_str:
            # Extract the model name from the error message
            model_name = error_str.split('model:', 1)[1].strip().rstrip('}').strip("'")
            print(f"ERROR: Model '{model_name}' not available")
            raise ValueError(f"model_problem:Model '{model_name}' not available. Check if you entered the correct model name.")
        
        # General API error - includes all other cases of AnthropicError
        print(f"ERROR: General API error: {error_str}")
        raise ValueError(f"model_problem:An error with API occurred during generation.")

    except Exception as e:
        #print(f"ERROR: General error: {str(e)}")
        
        # If already a custom error message, pass it through unchanged
        if isinstance(e, ValueError) and "model_problem:" in str(e):
            raise  # Re-raise current exception without change
        
        # General error - catch everything else
        raise ValueError(f"model_problem:Unexpected error during generation.")