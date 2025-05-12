/**
* TXT-AI-BPMN Application
* This script handles the UI interactions and BPMN model generation
*/

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const inputTabBtn = document.getElementById('input-tab-btn');
    const diagramTabBtn = document.getElementById('diagram-tab-btn');
    const inputTab = document.getElementById('input-tab');
    const diagramTab = document.getElementById('diagram-tab');

    // Spracovanie flash správ zo servera
    function processServerFlashMessages() {
        // Získame všetky flash správy vložené do DOM serverom (Flask)
        const serverFlashes = document.querySelectorAll('.flask-flash-message');
        
        // Ak existujú, spracujeme ich a odstránime z DOM
        serverFlashes.forEach(flashElem => {
            const message = flashElem.textContent.trim();
            const type = flashElem.getAttribute('data-type') || 'info';
            
            // Zobrazíme pomocou existujúcej funkcie showFlashMessage
            showFlashMessage(message, type);
            
            // Odstránime element, aby sa správa nezobrazila dvakrát
            flashElem.remove();
        });
    }

    // Volanie funkcie pri načítaní stránky
    processServerFlashMessages();

    const structuredInputTab = document.getElementById('structured-input-tab');
    const simpleInputTab = document.getElementById('simple-input-tab');
    const structuredInputSection = document.getElementById('structured-input-section');
    const simpleInputSection = document.getElementById('simple-input-section');

    const bpmnForm = document.getElementById('bpmn-form');
    const inputModeField = document.getElementById('input_mode');
    const generateButton = document.getElementById('generate-button');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Simple input file elements
    const fileInput = document.getElementById('file_input');
    const selectedFilename = document.getElementById('selected-filename');
    const clearFileButton = document.getElementById('clear-file');

    // Structured input file elements
    const structuredFileInput = document.getElementById('structured_file_input');
    const structuredSelectedFilename = document.getElementById('structured-selected-filename');
    const structuredClearFileButton = document.getElementById('structured-clear-file');

    const simpleTextInput = document.getElementById('simple_text_input');
    const structuredNameInput = document.getElementById('structured_name_input');
    const structuredFlowInput = document.getElementById('structured_flow_input');

    // Global variables
    let bpmnModeler;
    let activeTab = 'input';
    let savedViewbox = null;

    // Tab switching
    inputTabBtn.addEventListener('click', () => switchTab('input'));
    diagramTabBtn.addEventListener('click', () => switchTab('diagram'));

    // Input type switching
    structuredInputTab.addEventListener('click', () => switchInputType('STRUCTURED'));
    simpleInputTab.addEventListener('click', () => switchInputType('SIMPLE'));

    // Set default input type to STRUCTURED if not specified
    if (!currentInputMode) {
        switchInputType('STRUCTURED', false);
    }

    // File upload handling
    fileInput.addEventListener('change', (event) => handleFileUpload(event, 'simple'));
    clearFileButton.addEventListener('click', () => clearFileSelection('simple'));

    // Structured file upload handling
    structuredFileInput.addEventListener('change', (event) => handleFileUpload(event, 'structured'));
    structuredClearFileButton.addEventListener('click', () => clearFileSelection('structured'));

    // Form submission
    bpmnForm.addEventListener('submit', handleFormSubmit);

    // Save diagram
    const saveBpmnBtn = document.getElementById('save-bpmn');
    if (saveBpmnBtn) {
        saveBpmnBtn.addEventListener('click', saveDiagram);
    }

    // Set up clear text buttons
    const clearTextButtons = document.querySelectorAll('.btn-clear-text');
    clearTextButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            if (targetId) {
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.value = '';
                    // Focus on the cleared element
                    targetElement.focus();
                }
            }
        });
    });

    // Uloženie vybraného modelu do session storage 
    const modelSelector = document.getElementById('model-selector');
    if (modelSelector) {
        modelSelector.addEventListener('change', function() {
            // Uložiť výber do session storage (nie localStorage)
            sessionStorage.setItem('currentModelSelection', this.value);
        });
    }

    // Initialize based on server-provided data
    initializeApp();
    
    // Initialize the advanced options dropdown
    initAdvancedOptionsDropdown();
    
    // Initialize max tokens control
    initMaxTokensControl();

    // Add the new function here
    function initTabClasses() {
        // Get save button element
        const saveButton = document.getElementById('save-bpmn');
        
        // Set initial tab class on body based on which tab is active
        if (activeTab === 'input' || !activeTab) {
            document.body.classList.add('input-tab-active');
            document.body.classList.remove('diagram-tab-active');
            
            // Ensure button is hidden if we start on input tab
            if (saveButton) {
                saveButton.classList.add('hidden');
            }
        } else {
            document.body.classList.remove('input-tab-active');
            document.body.classList.add('diagram-tab-active');
            
            // Show button if we start on diagram tab
            if (saveButton) {
                saveButton.classList.remove('hidden');
            }
        }
    }

    // And call it immediately after defining it
    initTabClasses();

    function initTabVisibility() {
        // Get elements
        const saveButton = document.getElementById('save-bpmn');
        const statsWrapper = document.getElementById('stats-wrapper');
        
        // Set initial visibility based on active tab
        if (activeTab === 'input' || !activeTab) {
            document.body.classList.add('input-tab-active');
            document.body.classList.remove('diagram-tab-active');
            
            // Ensure elements are hidden if we start on input tab
            if (saveButton) {
                saveButton.classList.add('hidden');
            }
            if (statsWrapper) {
                statsWrapper.classList.add('hidden');
            }
        } else {
            document.body.classList.remove('input-tab-active');
            document.body.classList.add('diagram-tab-active');
            
            // Show elements if we start on diagram tab
            if (saveButton) {
                saveButton.classList.remove('hidden');
            }
            if (statsWrapper) {
                statsWrapper.classList.remove('hidden');
            }
        }
    }

    initTabVisibility();

    initStatsDropdown();

    // Initialize file uploads (restoring from session storage)
    initializeFileUploads();

    /**
     * Initialize the application
     */
    function initializeApp() {
        // Obnovenie predchádzajúceho výberu modelu zo session storage (ak existuje)
        if (modelSelector && sessionStorage.getItem('currentModelSelection')) {
            modelSelector.value = sessionStorage.getItem('currentModelSelection');
        }
        // Set input mode from server data
        if (currentInputMode) {
            inputModeField.value = currentInputMode;
            if (currentInputMode === 'STRUCTURED') {
                switchInputType('STRUCTURED', false);
            } else {
                switchInputType('SIMPLE', false);
            }
        } else {
            // Default to STRUCTURED if not specified
            switchInputType('STRUCTURED', false);
        }
        
        // Initialize BPMN modeler
        bpmnModeler = new BpmnJS({
            container: '#bpmn-canvas',
            keyboard: {
                bindTo: window
            }
        });
        
        // If we have a BPMN file from the server, load it
        if (bpmnFilename) {
            loadBpmnDiagram(bpmnFilename);
            switchTab('diagram');
        }
        
        // Initialize drag and drop for file uploads
        initDragAndDrop('simple-dropzone', null);
        initDragAndDrop('structured-dropzone', null);
    }

    /**
     * Initialize Advanced Options Dropdown
     */
    function initAdvancedOptionsDropdown() {
        const toggleBtn = document.getElementById('toggle-advanced-options');
        const optionsPanel = document.getElementById('advanced-options');
        
        if (toggleBtn && optionsPanel) {
            // Toggle advanced options dropdown
            toggleBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent event from bubbling up
                optionsPanel.classList.toggle('hidden');
                toggleBtn.classList.toggle('active');
                
                // Store state in sessionStorage
                const isVisible = !optionsPanel.classList.contains('hidden');
                sessionStorage.setItem('advancedOptionsOpen', isVisible.toString());
            });
            
            // Check if advanced options were previously expanded
            if (sessionStorage.getItem('advancedOptionsOpen') === 'true') {
                optionsPanel.classList.remove('hidden');
                toggleBtn.classList.add('active');
            }
            
            // Close dropdown when clicking elsewhere on the page
            document.addEventListener('click', function(e) {
                if (!optionsPanel.contains(e.target) && e.target !== toggleBtn) {
                    optionsPanel.classList.add('hidden');
                    toggleBtn.classList.remove('active');
                }
            });
            
            // Prevent dropdown from closing when clicking inside it
            optionsPanel.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            
            // Close with escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && !optionsPanel.classList.contains('hidden')) {
                    optionsPanel.classList.add('hidden');
                    toggleBtn.classList.remove('active');
                }
            });
            
            // Set up temperature range
            const temperatureRange = document.getElementById('temperature-setting');
            const temperatureValue = document.getElementById('temperature-value');
            if (temperatureRange && temperatureValue) {
                // Získanie uloženej hodnoty zo sessionStorage
                const savedTemp = sessionStorage.getItem('temperatureSetting');
                if (savedTemp) {
                    temperatureRange.value = savedTemp;
                    temperatureValue.textContent = savedTemp;
                }
                
                temperatureRange.addEventListener('input', function() {
                    temperatureValue.textContent = this.value;
                    // Použitie sessionStorage namiesto localStorage
                    sessionStorage.setItem('temperatureSetting', this.value);
                });
            }
        }
    }

    /**
     * Initialize Max Tokens Control
     */
    function initMaxTokensControl() {
        const maxTokensInput = document.getElementById('max-tokens-setting');
        if (maxTokensInput) {
            // Set constants
            const MIN_TOKENS = 1;
            const STEP_SIZE = 500;
            const DEFAULT_VALUE = 10000;
            
            // Set the min attribute for input element
            maxTokensInput.setAttribute('min', MIN_TOKENS);
            
            // Get the button elements
            const increaseTokensBtn = document.getElementById('increase-tokens');
            const decreaseTokensBtn = document.getElementById('decrease-tokens');
            
            // Increment function
            function stepUp() {
                const currentValue = parseInt(maxTokensInput.value) || DEFAULT_VALUE;
                const newValue = currentValue + STEP_SIZE;
                maxTokensInput.value = newValue;
                sessionStorage.setItem('maxTokensSetting', newValue.toString());
            }
            
            // Decrement function
            function stepDown() {
                const currentValue = parseInt(maxTokensInput.value) || DEFAULT_VALUE;
                const newValue = Math.max(currentValue - STEP_SIZE, MIN_TOKENS);
                maxTokensInput.value = newValue;
                sessionStorage.setItem('maxTokensSetting', newValue.toString());
            }
            
            // Add event listeners to the button elements
            if (increaseTokensBtn && decreaseTokensBtn) {
                increaseTokensBtn.addEventListener('click', stepUp);
                decreaseTokensBtn.addEventListener('click', stepDown);
            }
            
            // Handle arrow keys for stepping
            maxTokensInput.addEventListener('keydown', function(event) {
                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    stepUp();
                } else if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    stepDown();
                } else if (event.key === 'Enter') {
                    validateTokens();
                }
            });
            
            // Validation function
            function validateTokens() {
                let value = maxTokensInput.value.trim();
                
                // If empty, set to default value
                if (value === '') {
                    maxTokensInput.value = DEFAULT_VALUE;
                    sessionStorage.setItem('maxTokensSetting', DEFAULT_VALUE.toString());
                    return;
                }
                
                // Convert to number
                value = parseInt(value);
                
                // If not a valid number, set to default value
                if (isNaN(value)) {
                    maxTokensInput.value = DEFAULT_VALUE;
                    sessionStorage.setItem('maxTokensSetting', DEFAULT_VALUE.toString());
                    return;
                }
                
                // Enforce minimum
                if (value < MIN_TOKENS) {
                    maxTokensInput.value = MIN_TOKENS;
                    value = MIN_TOKENS;
                }
                
                // Store to sessionStorage
                sessionStorage.setItem('maxTokensSetting', value.toString());
            }
            
            // Validate on blur
            maxTokensInput.addEventListener('blur', validateTokens);
            
            // Check form submission
            const form = document.getElementById('bpmn-form');
            if (form) {
                form.addEventListener('submit', validateTokens);
            }
            
            // Load value from sessionStorage on page load
            const savedTokens = sessionStorage.getItem('maxTokensSetting');
            if (savedTokens && !isNaN(parseInt(savedTokens))) {
                maxTokensInput.value = savedTokens;
            }
        }
    }

    /**
     * Initialize statistics dropdown functionality
     */
    function initStatsDropdown() {
        const toggleBtn = document.getElementById('toggle-stats');
        const statsDropdown = document.getElementById('generation-stats');
        const statsWrapper = document.getElementById('stats-wrapper');
        
        if (toggleBtn && statsDropdown) {
            // Toggle statistics dropdown
            toggleBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent event from bubbling up
                statsDropdown.classList.toggle('hidden');
                toggleBtn.classList.toggle('active');
            });
            
            // Close dropdown when clicking elsewhere on the page
            document.addEventListener('click', function(e) {
                if (!statsDropdown.contains(e.target) && e.target !== toggleBtn) {
                    statsDropdown.classList.add('hidden');
                    toggleBtn.classList.remove('active');
                }
            });
            
            // Prevent dropdown from closing when clicking inside it
            statsDropdown.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            
            // Close with escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && !statsDropdown.classList.contains('hidden')) {
                    statsDropdown.classList.add('hidden');
                    toggleBtn.classList.remove('active');
                }
            });
        }
    }

    /**
     * Switch between main tabs (input/diagram)
     */
    function switchTab(tabName) {
        // Get elements
        const saveButton = document.getElementById('save-bpmn');
        const statsWrapper = document.getElementById('stats-wrapper');
        
        if (tabName === 'input') {
            // Uložiť aktuálny viewbox pred prepnutím na inú kartu
            if (bpmnModeler && activeTab === 'diagram') {
                savedViewbox = bpmnModeler.get('canvas').viewbox();
            }
            
            // Toggle tab active classes
            inputTabBtn.classList.add('active');
            diagramTabBtn.classList.remove('active');
            inputTab.classList.remove('hidden');
            diagramTab.classList.add('hidden');
            
            // Update body classes for conditional CSS
            document.body.classList.add('input-tab-active');
            document.body.classList.remove('diagram-tab-active');
            
            // Hide elements - only if they exist
            if (saveButton) {
                saveButton.classList.add('hidden');
            }
            if (statsWrapper) {
                statsWrapper.classList.add('hidden');
            }
        } else if (tabName === 'diagram') {
            // Toggle tab active classes
            inputTabBtn.classList.remove('active');
            diagramTabBtn.classList.add('active');
            inputTab.classList.add('hidden');
            diagramTab.classList.remove('hidden');
            
            // Update body classes for conditional CSS
            document.body.classList.remove('input-tab-active');
            document.body.classList.add('diagram-tab-active');
            
            // Show the button and stats - only if they exist AND we have stats to show
            if (saveButton) {
                saveButton.classList.remove('hidden');
            }
            if (statsWrapper) {
                statsWrapper.classList.remove('hidden');
            }
            
            // Ak máme bpmnModeler, obnoviť viewbox iba ak už bol predtým uložený
            if (bpmnModeler) {
                if (savedViewbox) {
                    // Obnoviť uložený viewbox namiesto nastavenia "fit-viewport"
                    bpmnModeler.get('canvas').viewbox(savedViewbox);
                } else {
                    // Iba pri prvom zobrazení nastaviť "fit-viewport"
                    bpmnModeler.get('canvas').zoom('fit-viewport');
                }
            }
        }
        
        activeTab = tabName;
    }

    /**
     * Switch between input types (structured/simple)
     */
    function switchInputType(inputType, updateField = true) {
        // Get the heading element for the file upload section
        const fileUploadHeading = document.querySelector('.config-section:nth-child(2) h3.config-heading');
        
        if (inputType === 'STRUCTURED') {
            structuredInputTab.classList.add('active');
            simpleInputTab.classList.remove('active');
            structuredInputSection.classList.remove('hidden');
            simpleInputSection.classList.add('hidden');
            
            // Show structured file upload, hide simple file upload
            document.getElementById('structured-file-upload-container').classList.remove('hidden');
            document.getElementById('simple-file-upload-container').classList.add('hidden');
            
            // Update file upload heading based on structured file status
            if (fileUploadHeading) {
                const structuredFilename = sessionStorage.getItem('structuredFilename');
                const structuredFileMode = sessionStorage.getItem('structuredFileMode');
                
                if (structuredFileMode === 'active' && structuredFilename) {
                    // Clear the heading text first
                    fileUploadHeading.textContent = "File Upload - ";
                    
                    // Create a span for the filename with a class
                    const filenameSpan = document.createElement('span');
                    filenameSpan.className = 'upload-filename';
                    filenameSpan.textContent = structuredFilename;
                    
                    // Append the span to the heading
                    fileUploadHeading.appendChild(filenameSpan);
                } else {
                    fileUploadHeading.textContent = "File Upload";
                }
            }
            
            if (updateField) inputModeField.value = 'STRUCTURED';
        } else {
            structuredInputTab.classList.remove('active');
            simpleInputTab.classList.add('active');
            structuredInputSection.classList.add('hidden');
            simpleInputSection.classList.remove('hidden');
            
            // Show simple file upload, hide structured file upload
            document.getElementById('structured-file-upload-container').classList.add('hidden');
            document.getElementById('simple-file-upload-container').classList.remove('hidden');
            
            // Update file upload heading based on simple file status
            if (fileUploadHeading) {
                const simpleFilename = sessionStorage.getItem('simpleFilename');
                const simpleFileMode = sessionStorage.getItem('simpleFileMode');
                
                if (simpleFileMode === 'active' && simpleFilename) {
                    // Clear the heading text first
                    fileUploadHeading.textContent = "File Upload - ";
                    
                    // Create a span for the filename with a class
                    const filenameSpan = document.createElement('span');
                    filenameSpan.className = 'upload-filename';
                    filenameSpan.textContent = simpleFilename;
                    
                    // Append the span to the heading
                    fileUploadHeading.appendChild(filenameSpan);
                } else {
                    fileUploadHeading.textContent = "File Upload";
                }
            }
            
            if (updateField) inputModeField.value = 'SIMPLE';
        }
    }

    /**
     * Initialize drag and drop functionality for a container
     */
    function initDragAndDrop(containerId, onFileDropped) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            container.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, unhighlight, false);
        });
        
        function highlight() {
            container.classList.add('drag-over');
        }
        
        function unhighlight() {
            container.classList.remove('drag-over');
        }
        
        container.addEventListener('drop', handleDrop, false);
        
        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files && files.length > 0) {
                const file = files[0];
                
                // Check file type - accept only .txt files
                if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
                    // Call the handler with the file
                    const fileInput = document.getElementById(containerId === 'simple-dropzone' ? 'file_input' : 'structured_file_input');
                    
                    // Create a DataTransfer object
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    
                    // Set the files property of the file input
                    fileInput.files = dataTransfer.files;
                    
                    // Trigger the change event
                    const event = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(event);
                } else {
                    showFlashMessage('Only text (.txt) files are supported', 'error');
                }
            }
        }
    }

    /**
     * Handle file upload
     */
    function handleFileUpload(event, mode) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Get the heading element SPECIFICALLY for the file upload section 
        // We need to target the second .config-section element's heading
        const fileUploadHeading = document.querySelector('.config-section:nth-child(2) h3.config-heading');
        
        if (mode === 'simple') {
            // Hide the filename area since we'll show it in the heading
            selectedFilename.textContent = '';
            
            // Update the heading with styled filename
            if (fileUploadHeading) {
                // Clear the heading text first
                fileUploadHeading.textContent = "File Upload - ";
                
                // Create a span for the filename with a class
                const filenameSpan = document.createElement('span');
                filenameSpan.className = 'upload-filename';
                filenameSpan.textContent = file.name;
                
                // Append the span to the heading
                fileUploadHeading.appendChild(filenameSpan);
            }
            
            // Add has-file class to container to show remove button
            document.getElementById('simple-file-upload-container').classList.add('has-file');
            
            // Save filename to session storage
            sessionStorage.setItem('simpleFilename', file.name);
            sessionStorage.setItem('simpleFileMode', 'active');
            
            // Read file content for simple mode
            const reader = new FileReader();
            reader.onload = function(e) {
                simpleTextInput.value = e.target.result;
            };
            
            reader.onerror = function() {
                showFlashMessage('Error reading file', 'error');
            };
            
            reader.readAsText(file);
        } else {
            // Hide the filename area since we'll show it in the heading
            structuredSelectedFilename.textContent = '';
            
            // Update the heading with styled filename
            if (fileUploadHeading) {
                // Clear the heading text first
                fileUploadHeading.textContent = "File Upload - ";
                
                // Create a span for the filename with a class
                const filenameSpan = document.createElement('span');
                filenameSpan.className = 'upload-filename';
                filenameSpan.textContent = file.name;
                
                // Append the span to the heading
                fileUploadHeading.appendChild(filenameSpan);
            }
            
            // Add has-file class to container to show remove button
            document.getElementById('structured-file-upload-container').classList.add('has-file');
            
            // Save filename to session storage
            sessionStorage.setItem('structuredFilename', file.name);
            sessionStorage.setItem('structuredFileMode', 'active');
            
            // Read file content for structured mode
            const reader = new FileReader();
            reader.onload = function(e) {
                structuredFlowInput.value = e.target.result;
            };
            
            reader.onerror = function() {
                showFlashMessage('Error reading file', 'error');
            };
            
            reader.readAsText(file);
        }
    }

    /**
     * Clear file selection
     */
    function clearFileSelection(mode) {
        // Get the heading element SPECIFICALLY for the file upload section
        const fileUploadHeading = document.querySelector('.config-section:nth-child(2) h3.config-heading');
        
        // Reset the heading text back to "File Upload"
        if (fileUploadHeading) {
            fileUploadHeading.textContent = "File Upload";
        }
        
        if (mode === 'simple') {
            fileInput.value = '';
            selectedFilename.textContent = '';
            
            // Remove has-file class to hide remove button
            document.getElementById('simple-file-upload-container').classList.remove('has-file');
            
            // Also clear the text field
            simpleTextInput.value = '';
            
            // Clear session storage
            sessionStorage.removeItem('simpleFilename');
            sessionStorage.removeItem('simpleFileMode');
        } else {
            structuredFileInput.value = '';
            structuredSelectedFilename.textContent = '';
            
            // Remove has-file class to hide remove button
            document.getElementById('structured-file-upload-container').classList.remove('has-file');
            
            // Also clear the text field
            structuredFlowInput.value = '';
            
            // Clear session storage
            sessionStorage.removeItem('structuredFilename');
            sessionStorage.removeItem('structuredFileMode');
        }
    }

    /**
     * Initialize file upload areas, including restoring state from session storage
     */
    function initializeFileUploads() {
        // Get the heading element SPECIFICALLY for the file upload section
        const fileUploadHeading = document.querySelector('.config-section:nth-child(2) h3.config-heading');
        
        // Check for saved simple file upload state
        const simpleFileMode = sessionStorage.getItem('simpleFileMode');
        const simpleFilename = sessionStorage.getItem('simpleFilename');
        
        if (simpleFileMode === 'active' && simpleFilename) {
            // Hide the filename display since we'll show it in the heading
            selectedFilename.textContent = '';
            
            // Update the heading if we're in simple mode
            if (simpleFileMode === 'active' && inputModeField.value === 'SIMPLE' && fileUploadHeading) {
                // Clear the heading text first
                fileUploadHeading.textContent = "File Upload - ";
                
                // Create a span for the filename with a class
                const filenameSpan = document.createElement('span');
                filenameSpan.className = 'upload-filename';
                filenameSpan.textContent = simpleFilename;
                
                // Append the span to the heading
                fileUploadHeading.appendChild(filenameSpan);
            }
            
            document.getElementById('simple-file-upload-container').classList.add('has-file');
        }
        
        // Check for saved structured file upload state
        const structuredFileMode = sessionStorage.getItem('structuredFileMode');
        const structuredFilename = sessionStorage.getItem('structuredFilename');
        
        if (structuredFileMode === 'active' && structuredFilename) {
            // Hide the filename display since we'll show it in the heading
            structuredSelectedFilename.textContent = '';
            
            // Update the heading if we're in structured mode
            if (structuredFileMode === 'active' && inputModeField.value === 'STRUCTURED' && fileUploadHeading) {
                // Clear the heading text first
                fileUploadHeading.textContent = "File Upload - ";
                
                // Create a span for the filename with a class
                const filenameSpan = document.createElement('span');
                filenameSpan.className = 'upload-filename';
                filenameSpan.textContent = structuredFilename;
                
                // Append the span to the heading
                fileUploadHeading.appendChild(filenameSpan);
            }
            
            document.getElementById('structured-file-upload-container').classList.add('has-file');
        }
    }

    /**
     * Handle form submission
     */
    function handleFormSubmit(event) {
        // Prevent default only if we need to show error
        const inputMode = inputModeField.value;
        let isValid = true;
        let errorMessage = '';
        
        if (inputMode === 'SIMPLE') {
            if (!simpleTextInput.value.trim()) {
                isValid = false;
                errorMessage = 'Please enter process description text';
            }
        } else { // STRUCTURED
            if (!structuredFlowInput.value.trim()) {
                isValid = false;
                errorMessage = 'Please enter process flow text';
            }
        }
        
        if (!isValid) {
            event.preventDefault();
            showFlashMessage(errorMessage, 'error');
            return;
        }
        
        // Store file upload information in session storage so it persists after form submission
        if (inputMode === 'SIMPLE' && selectedFilename.textContent) {
            sessionStorage.setItem('simpleFilename', selectedFilename.textContent);
            sessionStorage.setItem('simpleFileMode', 'active');
        } else if (inputMode === 'STRUCTURED' && structuredSelectedFilename.textContent) {
            sessionStorage.setItem('structuredFilename', structuredSelectedFilename.textContent);
            sessionStorage.setItem('structuredFileMode', 'active');
        }
        
        // Explicitne nastavte model ako skrytý input pred odoslaním formulára
        const modelSelector = document.getElementById('model-selector');
        if (modelSelector) {
            const selectedModel = modelSelector.value;
            
            // Vytvorte alebo aktualizujte skrytý input pre model
            let modelInput = document.getElementById('hidden-model-selection');
            if (!modelInput) {
                modelInput = document.createElement('input');
                modelInput.type = 'hidden';
                modelInput.id = 'hidden-model-selection';
                modelInput.name = 'model_selection';
                bpmnForm.appendChild(modelInput);
            }
            modelInput.value = selectedModel;
        }
        
        // If valid, show loading overlay - get a fresh reference
        const loadingOverlayElement = document.getElementById('loading-overlay');
        if (loadingOverlayElement) {
            loadingOverlayElement.classList.remove('hidden');
        } else {
            console.error('Loading overlay element not found!');
        }

        // Add additional hidden inputs for advanced options
        appendHiddenInputs();
    }

    /**
     * Append hidden inputs to the form for advanced options
     */
    function appendHiddenInputs() {
        // Add temperature if set
        if (document.getElementById('temperature-setting')) {
            const tempValue = document.getElementById('temperature-setting').value;
            let tempInput = document.getElementById('hidden-temperature');
            if (!tempInput) {
                tempInput = document.createElement('input');
                tempInput.type = 'hidden';
                tempInput.id = 'hidden-temperature';
                tempInput.name = 'temperature';
                bpmnForm.appendChild(tempInput);
            }
            tempInput.value = tempValue;
        }
        
        // Add max tokens if set
        if (document.getElementById('max-tokens-setting')) {
            const tokensValue = document.getElementById('max-tokens-setting').value;
            let tokensInput = document.getElementById('hidden-max-tokens');
            if (!tokensInput) {
                tokensInput = document.createElement('input');
                tokensInput.type = 'hidden';
                tokensInput.id = 'hidden-max-tokens';
                tokensInput.name = 'max_tokens';
                bpmnForm.appendChild(tokensInput);
            }
            tokensInput.value = tokensValue;
        }
    }

    /**
     * Load BPMN diagram from server
     */
    function loadBpmnDiagram(filename) {
        fetch(`/bpmn/${filename}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(bpmnXML => {
                bpmnModeler.importXML(bpmnXML)
                    .then(({ warnings }) => {
                        if (warnings.length) {
                            console.warn('BPMN import warnings:', warnings);
                        }
                        bpmnModeler.get('canvas').zoom('fit-viewport');
                        
                        // After successful import, delete the BPMN file from the server
                        deleteBpmnFile(filename);
                        
                        // Show success message
                        showFlashMessage('BPMN diagram was successfully generated and loaded', 'success');
                    })
                    .catch(err => {
                        showFlashMessage('Error displaying BPMN model.', 'error');
                        console.error('Error rendering BPMN diagram:', err);
                        
                        // Prepnúť späť na kartu Input pri chybe
                        switchTab('input');
                    });
            })
            .catch(error => {
                showFlashMessage('Error displaying BPMN model.', 'error');
                console.error('Error loading BPMN file:', error);
                
                // Prepnúť späť na kartu Input pri chybe
                switchTab('input');
            });
    }

    /**
     * Delete BPMN file from the server
     */
    function deleteBpmnFile(filename) {
        fetch(`/delete-bpmn/${filename}`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('BPMN file deleted from server:', filename);
            } else {
                console.warn('Failed to delete BPMN file:', data.message);
            }
        })
        .catch(error => {
            console.error('Error deleting BPMN file:', error);
        });
    }

    /**
     * Save BPMN diagram
     */
    function saveDiagram() {
        bpmnModeler.saveXML({ format: true })
            .then(({ xml }) => {
                // Create a blob from the XML
                const blob = new Blob([xml], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                
                // Create a temporary download link
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = 'diagram.bpmn';
                
                // Append to body, click and remove
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                // Release the object URL
                URL.revokeObjectURL(url);
            })
            .catch(err => {
                showFlashMessage('No model to be saved.', 'error');
                console.error('No model to be saved: ', err);
            });
    }

    /**
     * Show flash message
     */
    function showFlashMessage(message, type = 'info') {
        const flashContainer = document.getElementById('flash-container');
        
        // Create flash message element
        const flashMessage = document.createElement('div');
        flashMessage.className = `flash-message ${type}`;
        flashMessage.textContent = message;
        
        // Add to container
        flashContainer.appendChild(flashMessage);
        
        // Nastavenie času zobrazovania
        const displayTime = (type === 'error' || type === 'warning') ? 8000 : 5000;
        
        // Set timeout to remove
        setTimeout(() => {
            flashMessage.classList.add('fade-out');
            setTimeout(() => {
                if (flashContainer.contains(flashMessage)) {
                    flashContainer.removeChild(flashMessage);
                }
            }, 500);
        }, displayTime);
    }
});