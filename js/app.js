let currentUser = null;
const PROJECT_NAME = 'english-trainer';
let apiKey = null;
let apiKeys = []; // Array de múltiples API keys para rotar
let currentKeyIndex = 0;
let conversationHistory = [];

// Modelos Gemini disponibles (Enero 2025)
const GEMINI_MODELS = {
    // Gemma 3 (MEJOR CUOTA - 14,400 RPD!)
    GEMMA_12B: 'gemma-3-12b-it',  // Gemma 3 12B (30 RPM, 14.4K RPD) ⭐ MEJOR
    GEMMA_27B: 'gemma-3-27b-it',  // Gemma 3 27B (30 RPM, 14.4K RPD)
    GEMMA_4B: 'gemma-3-4b-it',    // Gemma 3 4B (30 RPM, 14.4K RPD)
    
    // Gemini 2.5 (Cuota baja - 20 RPD)
    FLASH_2_5: 'gemini-2.5-flash',  // 5 RPM, 20 RPD
    FLASH_2_5_LITE: 'gemini-2.5-flash-lite',  // 10 RPM, 20 RPD
    PRO_2_5: 'gemini-2.5-pro',  // Gemini 2.5 Pro
    
    // Gemini 2.0 (DISPONIBLES)
    FLASH_2: 'gemini-2.0-flash-exp',
    FLASH_2_STABLE: 'gemini-2.0-flash',
    
    // Gemini 1.5 (NO DISPONIBLES EN TU API KEY)
    FLASH_1_5: 'gemini-1.5-flash',
    PRO_1_5: 'gemini-1.5-pro',
    PRO_1_5_LATEST: 'gemini-1.5-pro-latest'
};

// Usa el modelo con mejor cuota disponible
let selectedModel = GEMINI_MODELS.GEMMA_12B;  // gemma-3-12b-it (30 RPM, 14.4K RPD) ⭐

// Contador de uso de API por modelo
let apiUsage = {};

// Cargar uso desde localStorage
function loadApiUsage() {
    const saved = localStorage.getItem('apiUsageByModel');
    if (saved) {
        apiUsage = JSON.parse(saved);
        
        // Limpiar datos antiguos de todos los modelos
        const today = new Date().toDateString();
        Object.keys(apiUsage).forEach(model => {
            if (apiUsage[model].lastDayReset !== today) {
                apiUsage[model].requestsToday = 0;
                apiUsage[model].lastDayReset = today;
            }
            
            const now = Date.now();
            apiUsage[model].requestTimestamps = apiUsage[model].requestTimestamps.filter(t => now - t < 60000);
            apiUsage[model].requestsThisMinute = apiUsage[model].requestTimestamps.length;
        });
    }
}

// Guardar uso en localStorage
function saveApiUsage() {
    localStorage.setItem('apiUsageByModel', JSON.stringify(apiUsage));
}

// Inicializar modelo si no existe
function initModelUsage(model) {
    if (!apiUsage[model]) {
        apiUsage[model] = {
            requestsToday: 0,
            requestsThisMinute: 0,
            lastDayReset: new Date().toDateString(),
            requestTimestamps: []
        };
    }
}

// Registrar request de API
function trackApiRequest() {
    initModelUsage(selectedModel);
    
    const now = Date.now();
    apiUsage[selectedModel].requestTimestamps.push(now);
    apiUsage[selectedModel].requestTimestamps = apiUsage[selectedModel].requestTimestamps.filter(t => now - t < 60000);
    apiUsage[selectedModel].requestsThisMinute = apiUsage[selectedModel].requestTimestamps.length;
    apiUsage[selectedModel].requestsToday++;
    saveApiUsage();
    updateUsageDisplay();
}

// Actualizar display de uso
function updateUsageDisplay() {
    const display = document.getElementById('usage-display');
    if (!display) return;
    
    initModelUsage(selectedModel);
    
    const limits = {
        'gemma-3-12b-it': { rpm: 30, rpd: 14400 },
        'gemma-3-4b-it': { rpm: 30, rpd: 14400 },
        'gemma-3-27b-it': { rpm: 30, rpd: 14400 },
        'gemini-2.5-flash': { rpm: 5, rpd: 20 },
        'gemini-2.5-flash-lite': { rpm: 10, rpd: 20 }
    };
    
    const limit = limits[selectedModel] || { rpm: 30, rpd: 14400 };
    const usage = apiUsage[selectedModel];
    const rpmPercent = Math.min((usage.requestsThisMinute / limit.rpm) * 100, 100);
    const rpdPercent = Math.min((usage.requestsToday / limit.rpd) * 100, 100);
    
    let rpmColor = rpmPercent < 70 ? '#10b981' : rpmPercent < 90 ? '#f59e0b' : '#ef4444';
    let rpdColor = rpdPercent < 70 ? '#10b981' : rpdPercent < 90 ? '#f59e0b' : '#ef4444';
    
    display.innerHTML = `
        <div style="margin-bottom:0.75rem;">
            <strong style="color:#667eea;">${selectedModel}</strong>
        </div>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
                    <span style="font-size:0.85rem;color:#666;">Requests/Minuto</span>
                    <span style="font-size:0.85rem;font-weight:600;color:${rpmColor};">${usage.requestsThisMinute}/${limit.rpm}</span>
                </div>
                <div style="background:#e2e8f0;height:8px;border-radius:4px;overflow:hidden;">
                    <div style="background:${rpmColor};height:100%;width:${rpmPercent}%;transition:width 0.3s;"></div>
                </div>
            </div>
            <div style="flex:1;min-width:200px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
                    <span style="font-size:0.85rem;color:#666;">Requests/Día</span>
                    <span style="font-size:0.85rem;font-weight:600;color:${rpdColor};">${usage.requestsToday}/${limit.rpd}</span>
                </div>
                <div style="background:#e2e8f0;height:8px;border-radius:4px;overflow:hidden;">
                    <div style="background:${rpdColor};height:100%;width:${rpdPercent}%;transition:width 0.3s;"></div>
                </div>
            </div>
        </div>
    `;
}

loadApiUsage();

// Autenticación con Firebase
auth.onAuthStateChanged(user => {
    currentUser = user;
    updateUI();
    if (user) {
        loadApiKey();
        loadUserProgress();
        loadConversationHistory();
    }
});

// Manejar resultado de redirect en móviles (debe ejecutarse al cargar la página)
auth.getRedirectResult().then((result) => {
    if (result && result.user) {
        console.log('Login exitoso desde redirect:', result.user.displayName);
        // El onAuthStateChanged se encargará del resto
    }
}).catch((error) => {
    console.error('Error en redirect:', error);
    if (error.code && error.code !== 'auth/popup-closed-by-user') {
        alert('Error al iniciar sesión: ' + error.message);
    }
});

function updateUI() {
    const userInfo = document.getElementById('user-info');
    if (currentUser) {
        userInfo.innerHTML = `
            <div class="user-profile">
                <span class="user-name">👤 ${currentUser.displayName}</span>
                <button class="logout-btn" onclick="signOut()">Salir</button>
            </div>
        `;
    } else {
        userInfo.innerHTML = `<button class="login-btn" onclick="signIn()">Iniciar Sesión</button>`;
    }
}

async function signIn() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        // Siempre usar popup (funciona mejor en móviles modernos)
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Error completo:', error);
        
        // Si falla el popup, intentar redirect como fallback
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
            try {
                await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
            } catch (redirectError) {
                alert('Error al iniciar sesión: ' + redirectError.message);
            }
        } else {
            alert('Error al iniciar sesión: ' + error.message + '\n\nIntenta desactivar el bloqueo de cookies de terceros en tu navegador.');
        }
    }
}

async function signOut() {
    try {
        await auth.signOut();
        conversationHistory = [];
        messagesDiv.innerHTML = '<div class="message bot">👋 Hi! I\'m your English teacher. Let\'s chat about anything - work, food, daily life, or whatever you want to practice!</div>';
    } catch (error) {
        alert('Error al cerrar sesión: ' + error.message);
    }
}

async function loadApiKey() {
    if (!currentUser) return;
    
    try {
        const snapshot = await db.ref(`projects/${PROJECT_NAME}/users/${currentUser.uid}/config/api_key_encrypted`).once('value');
        const encryptedKey = snapshot.val();
        
        if (encryptedKey) {
            const password = sessionStorage.getItem('gemini_password');
            if (password) {
                apiKey = decryptApiKey(encryptedKey, password);
            } else {
                // Solicitar contraseña al usuario
                const pwd = prompt('Ingresa tu contraseña para desencriptar la API key:');
                if (pwd) {
                    apiKey = decryptApiKey(encryptedKey, pwd);
                    if (apiKey) {
                        sessionStorage.setItem('gemini_password', pwd);
                    } else {
                        alert('Contraseña incorrecta');
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error cargando API key:', error);
    }
}

function decryptApiKey(encryptedText, password) {
    try {
        const salt = CryptoJS.enc.Hex.parse(encryptedText.substr(0, 32));
        const iv = CryptoJS.enc.Hex.parse(encryptedText.substr(32, 32));
        const ciphertext = encryptedText.substr(64);
        const key = CryptoJS.PBKDF2(password, salt, { keySize: 256/32 });
        const decrypted = CryptoJS.AES.decrypt(ciphertext, key, { iv: iv });
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        console.error('Error desencriptando:', error);
        return null;
    }
}

let recognition = null;
let synthesis = window.speechSynthesis;
let isRecording = false;
let lastMessageWasVoice = false;
let pronunciationScore = null;
let grammarCheckTimeout = null;
let silenceTimeout = null;
let accumulatedTranscript = '';
let messagesDiv, userInput, sendBtn, micBtn, grammarFeedback;

// Esperar a que el DOM esté listo
setTimeout(() => {
    messagesDiv = document.getElementById('messages');
    userInput = document.getElementById('user-input');
    sendBtn = document.getElementById('send-btn');
    micBtn = document.getElementById('mic-btn');
    grammarFeedback = document.getElementById('grammar-feedback');
    
    // Menú hamburguesa para móviles
    const menuToggle = document.getElementById('menu-toggle');
    const tabsMenu = document.getElementById('tabs-menu');
    const currentTabName = document.getElementById('current-tab-name');
    const mobileNav = document.getElementById('mobile-nav');
    
    if (menuToggle && tabsMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            tabsMenu.classList.toggle('show');
            
            // Posicionar el menú justo debajo del botón
            if (tabsMenu.classList.contains('show') && mobileNav) {
                const rect = mobileNav.getBoundingClientRect();
                tabsMenu.style.top = (rect.bottom) + 'px';
            }
        });
        
        // Cerrar menú al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!menuToggle.contains(e.target) && !tabsMenu.contains(e.target)) {
                tabsMenu.classList.remove('show');
            }
        });
    }
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            
            // Actualizar nombre de tab actual
            if (currentTabName) {
                currentTabName.textContent = tab.textContent;
            }
            
            // Cerrar menú en móviles
            if (tabsMenu) {
                tabsMenu.classList.remove('show');
            }
            
            if (tabName === 'translator') loadTranslator();
            if (tabName === 'practice') loadPractice();
            if (tabName === 'pronunciation') loadPronunciation();
            if (tabName === 'listening') loadListening();
            if (tabName === 'progress') loadProgress();
            if (tabName === 'config') loadConfig();
        });
    });
    
    // Detectar si el navegador soporta reconocimiento de voz
    const isBrave = navigator.brave && typeof navigator.brave.isBrave === 'function';
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = true;
        
        // Mostrar banner informativo en Brave
        if (isBrave) {
            const banner = document.createElement('div');
            banner.id = 'brave-banner';
            banner.style.cssText = 'background:#f8d7da;color:#721c24;padding:0.75rem;text-align:center;border-bottom:1px solid #f5c6cb;font-size:0.9rem;position:relative;';
            banner.innerHTML = '❌ <strong>Brave no soporta reconocimiento de voz</strong> por razones de privacidad (incluso con Shields desactivado). Usa <strong>Chrome o Edge</strong> para esta función.';
            document.body.insertBefore(banner, document.body.firstChild);
            
            // Deshabilitar botón de micrófono en Brave
            micBtn.style.opacity = '0.5';
            micBtn.style.cursor = 'not-allowed';
            micBtn.disabled = true;
        }
        
        recognition.onstart = () => {
            userInput.placeholder = 'Listening...';
        };
        
        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            userInput.value = transcript;
            
            // Auto-expandir textarea
            userInput.style.height = 'auto';
            userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
        };
        
        recognition.onerror = (event) => {
            micBtn.textContent = '🎤';
            isRecording = false;
            
            const errorMessages = {
                'no-speech': '🔇 No se detectó voz. Habla más cerca del micrófono.',
                'audio-capture': '🎤 No se puede acceder al micrófono. Verifica que esté conectado.',
                'not-allowed': '⛔ Permiso denegado. Click en el candado 🔒 en la barra de direcciones y permite el micrófono.',
                'network': '🌐 Error de conexión. Verifica tu internet.',
                'aborted': '⏹️ Grabación cancelada.',
                'service-not-allowed': '🚫 Servicio bloqueado por el navegador.'
            };
            
            const message = errorMessages[event.error] || `❌ Error: ${event.error}`;
            alert(message);
            
            console.error('Speech recognition error:', event.error, event);
        };
        
        recognition.onend = async () => {
            if (isRecording && userInput.value.trim()) {
                setTimeout(async () => {
                    micBtn.textContent = '🎤';
                    isRecording = false;
                    lastMessageWasVoice = true;
                    await evaluatePronunciation(userInput.value.trim());
                    sendMessage();
                }, 3000);
            } else {
                micBtn.textContent = '🎤';
                isRecording = false;
            }
        };
    } else {
        // Navegador no soporta reconocimiento de voz
        const banner = document.createElement('div');
        banner.style.cssText = 'background:#f8d7da;color:#721c24;padding:0.75rem;text-align:center;border-bottom:1px solid #f5c6cb;font-size:0.9rem;';
        banner.innerHTML = '❌ <strong>Reconocimiento de voz no disponible</strong> en este navegador. Usa Chrome, Edge o Safari para esta función.';
        document.body.insertBefore(banner, document.body.firstChild);
        
        // Deshabilitar visualmente el botón del micrófono
        micBtn.style.opacity = '0.5';
        micBtn.style.cursor = 'not-allowed';
    }
    
    micBtn.addEventListener('click', () => {
        if (!recognition || (isBrave && micBtn.disabled)) {
            alert('❌ Reconocimiento de voz no disponible en Brave.\n\nBrave bloquea esta API por privacidad (envía audio a Google).\n\nUsa Chrome o Edge para esta función.');
            return;
        }
        
        // Silenciar la IA si está hablando (forzar detención completa)
        synthesis.cancel();
        synthesis.pause();
        
        // Actualizar todos los botones de audio
        document.querySelectorAll('.speak-btn').forEach(btn => {
            btn.textContent = '🔊';
        });
        
        if (isRecording) {
            clearTimeout(silenceTimeout);
            recognition.stop();
            micBtn.textContent = '🎤';
            isRecording = false;
            if (userInput.value.trim()) {
                lastMessageWasVoice = true;
                evaluatePronunciation(userInput.value).then(() => sendMessage());
            }
            accumulatedTranscript = '';
        } else {
            try {
                userInput.value = '';
                accumulatedTranscript = '';
                recognition.start();
                micBtn.textContent = '🔴';
                isRecording = true;
            } catch (error) {
                alert('⚠️ No se pudo iniciar el reconocimiento de voz.\n\nVerifica los permisos del micrófono o usa Chrome/Edge.');
                micBtn.textContent = '🎤';
                isRecording = false;
            }
        }
    });
    
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', e => { 
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Correción gramatical en tiempo real y auto-expansión
    userInput.addEventListener('input', () => {
        // Auto-expandir textarea
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
        
        clearTimeout(grammarCheckTimeout);
        const text = userInput.value.trim();
        
        if (text.length > 10) {
            grammarCheckTimeout = setTimeout(() => checkGrammar(text), 1500);
        } else {
            grammarFeedback.innerHTML = '';
        }
    });
}, 100);

async function evaluatePronunciation(text) {
    if (!apiKey || !currentUser) {
        pronunciationScore = 85;
        return;
    }
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Rate the clarity and grammar of this English sentence from 0-100. Only respond with the number. Sentence: "${text}"` }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 10
                }
            })
        });
        
        const data = await response.json();
        if (data.candidates && data.candidates[0]) {
            const score = parseInt(data.candidates[0].content.parts[0].text.match(/\d+/)?.[0] || '85');
            pronunciationScore = Math.min(100, Math.max(0, score));
        } else {
            pronunciationScore = 85;
        }
    } catch (error) {
        pronunciationScore = 85;
    }
}

async function checkGrammar(text) {
    if (!apiKey || !currentUser) return;
    
    grammarFeedback.innerHTML = '<span style="color:#94a3b8;font-size:0.85rem;">⏳ Checking...</span>';
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Analyze this English sentence for grammar errors. If correct, respond ONLY "CORRECT". If there are errors, respond with: "ERROR: [brief correction]". Sentence: "${text}"` }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 80
                }
            })
        });
        
        const data = await response.json();
        if (data.candidates && data.candidates[0]) {
            const feedback = data.candidates[0].content.parts[0].text.trim();
            
            if (feedback.toUpperCase().includes('CORRECT')) {
                grammarFeedback.innerHTML = '<span style="color:#10b981;font-size:0.85rem;font-weight:500;">✅ Perfect!</span>';
            } else if (feedback.includes('ERROR:')) {
                const correction = feedback.replace(/ERROR:\s*/i, '');
                grammarFeedback.innerHTML = `<span style="color:#ef4444;font-size:0.85rem;font-weight:500;">❌ ${correction}</span>`;
            } else {
                grammarFeedback.innerHTML = `<span style="color:#f59e0b;font-size:0.85rem;">💡 ${feedback}</span>`;
            }
        }
    } catch (error) {
        grammarFeedback.innerHTML = '';
    }
}

async function sendMessage() {
    if (!currentUser) { alert('Debes iniciar sesión'); return; }
    const text = userInput.value.trim();
    if (!text) return;
    
    const wasVoice = lastMessageWasVoice;
    lastMessageWasVoice = false;
    
    addMessage('user', text);
    userInput.value = '';
    
    const response = await getAIResponse(text);
    addMessage('bot', response, wasVoice);
    
    await saveConversation(text, response);
    await updateProgress();
}

function addMessage(sender, text, autoSpeak = false, isHistory = false) {
    const msg = document.createElement('div');
    msg.className = `message ${sender}`;
    
    const textContent = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    if (sender === 'bot') {
        const contentDiv = document.createElement('span');
        contentDiv.innerHTML = textContent;
        
        const speakBtn = document.createElement('button');
        speakBtn.className = 'speak-btn';
        speakBtn.textContent = '🔊';
        speakBtn.onclick = () => speakText(text, speakBtn);
        
        msg.appendChild(contentDiv);
        msg.appendChild(speakBtn);
        
        // Reproducir automáticamente si fue mensaje de voz
        if (autoSpeak) {
            setTimeout(() => speakText(text, speakBtn), 300);
        }
    } else {
        msg.innerHTML = textContent;
        
        // Mostrar puntuación de pronunciación si existe
        if (pronunciationScore !== null && !isHistory) {
            const scoreDiv = document.createElement('div');
            scoreDiv.style.cssText = 'font-size:0.75rem;margin-top:0.25rem;opacity:0.8;';
            let emoji, color;
            if (pronunciationScore >= 80) {
                emoji = '🎉';
                color = '#10b981';
            } else if (pronunciationScore >= 60) {
                emoji = '👍';
                color = '#f59e0b';
            } else {
                emoji = '💪';
                color = '#ef4444';
            }
            scoreDiv.innerHTML = `<span style="color:${color};">${emoji} Pronunciation: ${pronunciationScore}%</span>`;
            msg.appendChild(scoreDiv);
            pronunciationScore = null;
        }
    }
    
    messagesDiv.appendChild(msg);
    if (!isHistory) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

function speakText(text, button) {
    if (!synthesis) {
        alert('Tu navegador no soporta síntesis de voz');
        return;
    }
    
    // Si está hablando, pausar o reanudar
    if (synthesis.speaking) {
        if (synthesis.paused) {
            synthesis.resume();
            button.textContent = '🔊';
        } else {
            synthesis.pause();
            button.textContent = '⏸️';
        }
        return;
    }
    
    // Cancelar y reiniciar el sistema de voz
    synthesis.cancel();
    
    // Esperar un momento para que se limpie
    setTimeout(() => {
        startSpeech(text, button);
    }, 50);
}

let currentUtterance = null;

function startSpeech(text, button) {
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/\*\*/g, '');
    currentUtterance = new SpeechSynthesisUtterance(cleanText);
    currentUtterance.lang = 'en-US';
    
    const voices = synthesis.getVoices();
    const femaleVoice = voices.find(v => 
        v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Victoria'))
    ) || voices.find(v => 
        v.lang.startsWith('en') && (v.name.includes('Zira') || v.name.includes('Aria'))
    ) || voices.find(v => 
        v.lang.startsWith('en') && v.name.toLowerCase().includes('woman')
    ) || voices.filter(v => v.lang.startsWith('en-US')).find(v => !v.name.includes('Male'));
    
    if (femaleVoice) {
        currentUtterance.voice = femaleVoice;
        currentUtterance.rate = 0.9;
        currentUtterance.pitch = 1.1;
    } else {
        // Si no hay voz femenina, ajustar pitch para simular voz femenina
        currentUtterance.rate = 0.85;
        currentUtterance.pitch = 1.5;
    }
    
    currentUtterance.onstart = () => {
        button.textContent = '⏸️';
    };
    
    currentUtterance.onend = () => {
        button.textContent = '🔊';
        synthesis.cancel();
        currentUtterance = null;
    };
    
    currentUtterance.onerror = () => {
        button.textContent = '🔊';
        synthesis.cancel();
        currentUtterance = null;
    };
    
    synthesis.speak(currentUtterance);
}

async function getAIResponse(text) {
    if (!apiKey) return 'Please configure your API key first.';
    
    conversationHistory.push({ role: 'user', parts: [{ text }] });
    
    const isSpanishRequest = /español|traduc|qué (es|significa)|what does.*mean|explica/i.test(text);
    const systemPrompt = isSpanishRequest 
        ? `Eres un profesor de inglés conversacional. Responde en español. Explica y luego haz una pregunta de seguimiento.`
        : `You are a conversational English teacher. Reply in English. Answer naturally, then ask a follow-up question to keep the conversation flowing. Be friendly and engaging.`;
    
    const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...conversationHistory.slice(-6)
    ];
    
    try {
        trackApiRequest();
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: 0.9,
                    topK: 20,
                    topP: 0.8,
                    maxOutputTokens: 300,
                    responseModalities: ["TEXT"]
                },
                safetySettings: [{
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE"
                }]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0]) {
            throw new Error('Invalid API response');
        }
        
        const candidate = data.candidates[0];
        let reply = '';
        
        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
            reply = candidate.content.parts[0].text;
        } else if (candidate.content && candidate.content.text) {
            reply = candidate.content.text;
        } else {
            reply = '⚠️ API error: Model returned empty response. Try again or check your API key.';
        }
        
        conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
        return reply;
    } catch (error) {
        console.error('Error:', error);
        return 'Error: ' + (error.message || 'Check your API key.');
    }
}

async function saveConversation(userMsg, botMsg) {
    if (!currentUser) return;
    try {
        const path = `projects/${PROJECT_NAME}/users/${currentUser.uid}/conversations`;
        await db.ref(path).push({ user: userMsg, bot: botMsg, timestamp: Date.now() });
    } catch (error) {
        console.error('Error guardando conversación:', error);
    }
}

async function updateProgress() {
    if (!currentUser) return;
    try {
        const path = `projects/${PROJECT_NAME}/users/${currentUser.uid}/progress`;
        await db.ref(path).set(userProgress);
    } catch (error) {
        console.error('Error actualizando progreso:', error);
    }
}

// Función movida más abajo con la UI de progreso

async function loadConversationHistory() {
    if (!currentUser) return;
    
    try {
        const snapshot = await db.ref(`projects/${PROJECT_NAME}/users/${currentUser.uid}/conversations`).limitToLast(10).once('value');
        const conversations = snapshot.val();
        
        if (conversations) {
            conversationHistory = [];
            
            // Agregar botón para limpiar historial
            const clearBtn = document.createElement('button');
            clearBtn.textContent = '🗑️ Limpiar historial';
            clearBtn.style.cssText = 'margin:1rem auto;display:block;padding:0.5rem 1rem;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;';
            clearBtn.onclick = clearHistory;
            messagesDiv.appendChild(clearBtn);
            
            Object.values(conversations).forEach(conv => {
                addMessage('user', conv.user, false, true);
                addMessage('bot', conv.bot, false, true);
                conversationHistory.push({ role: 'user', parts: [{ text: conv.user }] });
                conversationHistory.push({ role: 'model', parts: [{ text: conv.bot }] });
            });
            
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    } catch (error) {
        console.error('Error cargando historial:', error);
    }
}

async function clearHistory() {
    if (!currentUser) return;
    
    if (confirm('¿Seguro que quieres limpiar el historial del chat?')) {
        try {
            await db.ref(`projects/${PROJECT_NAME}/users/${currentUser.uid}/conversations`).remove();
            messagesDiv.innerHTML = '<div class="message bot">👋 Hi! I\'m your English teacher. Let\'s chat about anything - work, food, daily life, or whatever you want to practice!</div>';
            conversationHistory = [];
        } catch (error) {
            alert('Error al limpiar historial: ' + error.message);
        }
    }
}

const PRACTICE_SENTENCES = [
    { es: 'Necesito desplegar la aplicación en el clúster de Kubernetes', en: 'I need to deploy the application to the Kubernetes cluster' },
    { es: 'El pipeline de CI/CD automatiza las pruebas', en: 'The CI/CD pipeline automates testing' },
    { es: 'Debemos escalar la infraestructura para manejar más tráfico', en: 'We need to scale the infrastructure to handle more traffic' },
    { es: 'El balanceador de carga distribuye las peticiones', en: 'The load balancer distributes the requests' },
    { es: 'Vamos a hacer un rollback a la versión anterior', en: 'We are going to rollback to the previous version' },
    { es: 'El monitoreo detectó un problema en producción', en: 'Monitoring detected a problem in production' },
    { es: 'Los contenedores están corriendo en Docker', en: 'The containers are running on Docker' },
    { es: 'Necesitamos crear un backup antes de la actualización', en: 'We need to create a backup before the update' },
    { es: 'La orquestación de contenedores simplifica el despliegue', en: 'Container orchestration simplifies deployment' },
    { es: 'El gateway API enruta las solicitudes a los microservicios', en: 'The API gateway routes requests to microservices' },
    { es: 'Terraform aprovisiona la infraestructura como código', en: 'Terraform provisions infrastructure as code' },
    { es: 'El tiempo de inactividad fue mínimo durante la migración', en: 'Downtime was minimal during the migration' },
    { es: 'Configuramos alta disponibilidad para el sistema', en: 'We configured high availability for the system' },
    { es: 'El repositorio contiene todo el código fuente', en: 'The repository contains all the source code' },
    { es: 'El flujo de trabajo está automatizado con GitHub Actions', en: 'The workflow is automated with GitHub Actions' }
];

let currentSentence = null;

async function loadTranslator() {
    const area = document.getElementById('translator-area');
    area.innerHTML = `
        <h2 style="margin-bottom:1.5rem;color:#2d3748;">🌎 Traductor</h2>
        <div class="practice-card">
            <div style="margin-bottom:1rem;">
                <label style="display:block;margin-bottom:0.5rem;font-weight:bold;">Dirección:</label>
                <select id="translation-direction" style="width:100%;padding:0.75rem;border:2px solid #e2e8f0;border-radius:8px;font-size:1rem;">
                    <option value="en-es">Inglés → Español</option>
                    <option value="es-en">Español → Inglés</option>
                </select>
            </div>
            <textarea id="translator-input" placeholder="Escribe texto para traducir..." class="practice-input" style="min-height:120px;resize:vertical;"></textarea>
            <button onclick="translateText()" class="practice-btn" style="width:100%;margin-top:1rem;">🔄 Traducir</button>
            <div id="translation-result" style="margin-top:1.5rem;"></div>
        </div>
    `;
}

async function translateText() {
    const input = document.getElementById('translator-input').value.trim();
    const direction = document.getElementById('translation-direction').value;
    const result = document.getElementById('translation-result');
    
    if (!input) {
        result.innerHTML = '<p style="color:#e74c3c;">⚠️ Escribe algo para traducir</p>';
        return;
    }
    
    if (!apiKey) {
        result.innerHTML = '<p style="color:#e74c3c;">⚠️ Configura tu API key primero</p>';
        return;
    }
    
    result.innerHTML = '<p style="color:#3498db;">⏳ Traduciendo...</p>';
    
    const prompt = direction === 'en-es' 
        ? `Translate this English text to Spanish: "${input}". Only respond with the translation.`
        : `Translate this Spanish text to English: "${input}". Only respond with the translation.`;
    
    try {
        trackApiRequest();
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 500
                }
            })
        });
        
        const data = await response.json();
        const translation = data.candidates[0].content.parts[0].text.trim();
        
        result.innerHTML = `
            <div style="background:#f8f9fa;padding:1.5rem;border-radius:8px;border-left:4px solid #667eea;">
                <p style="margin-bottom:0.5rem;color:#666;font-size:0.9rem;"><strong>Original:</strong></p>
                <p style="margin-bottom:1rem;">${input}</p>
                <p style="margin-bottom:0.5rem;color:#666;font-size:0.9rem;"><strong>Traducción:</strong></p>
                <p style="font-size:1.1rem;color:#667eea;font-weight:500;">${translation}</p>
            </div>
        `;
    } catch (error) {
        result.innerHTML = '<p style="color:#e74c3c;">❌ Error al traducir. Intenta de nuevo.</p>';
    }
}

async function loadProgress() {
    const area = document.getElementById('progress-area');
    
    // Asegurar que userProgress tenga las propiedades necesarias
    if (!userProgress.pronunciationScores) userProgress.pronunciationScores = [];
    if (!userProgress.practiceScores) userProgress.practiceScores = [];
    if (!userProgress.listeningScores) userProgress.listeningScores = [];
    if (!userProgress.difficultWords) userProgress.difficultWords = {};
    
    const avgPronunciation = userProgress.pronunciationScores.length > 0
        ? Math.round(userProgress.pronunciationScores.reduce((a, b) => a + b, 0) / userProgress.pronunciationScores.length)
        : 0;
    
    const avgPractice = userProgress.practiceScores.length > 0
        ? Math.round(userProgress.practiceScores.reduce((a, b) => a + b, 0) / userProgress.practiceScores.length)
        : 0;
    
    const avgListening = userProgress.listeningScores.length > 0
        ? Math.round(userProgress.listeningScores.reduce((a, b) => a + b, 0) / userProgress.listeningScores.length)
        : 0;
    
    const difficultWordsList = Object.entries(userProgress.difficultWords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    area.innerHTML = `
        <h2 style="margin-bottom:1.5rem;color:#2d3748;">📈 Tu Progreso</h2>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem;">
            <div class="vocab-card" style="text-align:center;">
                <h3 style="color:#667eea;font-size:2rem;margin-bottom:0.5rem;">${userProgress.pronunciationScores.length}</h3>
                <p style="color:#666;">Ejercicios de Pronunciación</p>
                <p style="color:#10b981;font-weight:600;margin-top:0.5rem;">${avgPronunciation}% promedio</p>
            </div>
            <div class="vocab-card" style="text-align:center;">
                <h3 style="color:#11998e;font-size:2rem;margin-bottom:0.5rem;">${userProgress.listeningScores.length}</h3>
                <p style="color:#666;">Ejercicios de Listening</p>
                <p style="color:#10b981;font-weight:600;margin-top:0.5rem;">${avgListening}% promedio</p>
            </div>
            <div class="vocab-card" style="text-align:center;">
                <h3 style="color:#f59e0b;font-size:2rem;margin-bottom:0.5rem;">${userProgress.practiceScores.length}</h3>
                <p style="color:#666;">Ejercicios de Práctica</p>
            </div>
        </div>
        
        <div class="vocab-card">
            <h3 style="margin-bottom:1rem;">💪 Palabras para Repasar</h3>
            ${difficultWordsList.length > 0 ? `
                <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
                    ${difficultWordsList.map(([word, count]) => `
                        <span style="background:#ef444415;color:#ef4444;padding:0.5rem 1rem;border-radius:8px;font-weight:500;">
                            ${word} <span style="opacity:0.7;font-size:0.85rem;">(${count}x)</span>
                        </span>
                    `).join('')}
                </div>
                <button onclick="practiceReview()" class="practice-btn" style="margin-top:1rem;">🔄 Practicar Palabras Difíciles</button>
            ` : '<p style="color:#666;">¡Aún no hay palabras difíciles! Sigue practicando.</p>'}
        </div>
    `;
}

function practiceReview() {
    alert('🚧 Función de repaso en desarrollo. Próximamente podrás practicar tus palabras difíciles.');
}

async function loadPractice() {
    loadRandomSentence();
}

let PRONUNCIATION_SENTENCES = [];

let currentPronunciationSentence = null;
let pronunciationRecognition = null;
let userProgress = {
    pronunciationScores: [],
    practiceScores: [],
    difficultWords: {},
    totalPracticeTime: 0,
    lastPracticeDate: null
};

// Rate limiting mejorado
const apiRateLimiter = {
    requests: [],
    maxPerMinute: 28,  // Límite seguro (de 30 disponibles)
    maxPerDay: 14000,  // Límite diario seguro (de 14,400 disponibles)
    dailyRequests: [],
    minDelay: 2000,  // 2 segundos entre requests
    lastRequest: 0,
    async waitIfNeeded() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;
        
        if (timeSinceLastRequest < this.minDelay) {
            await new Promise(resolve => setTimeout(resolve, this.minDelay - timeSinceLastRequest));
        }
        
        this.requests = this.requests.filter(time => now - time < 60000);
        
        if (this.requests.length >= this.maxPerMinute) {
            const waitTime = 60000 - (now - this.requests[0]) + 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequest = Date.now();
        this.requests.push(this.lastRequest);
    },
    canMakeRequest() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < 60000);
        return this.requests.length < this.maxPerMinute;
    },
    addRequest() {
        this.requests.push(Date.now());
    },
    getWaitTime() {
        if (this.requests.length === 0) return 0;
        const oldestRequest = Math.min(...this.requests);
        const waitTime = Math.ceil((60000 - (Date.now() - oldestRequest)) / 1000);
        return Math.max(0, waitTime);
    }
};

// Caché de evaluaciones
const evaluationCache = new Map();

// Cargar progreso desde Firebase
async function loadUserProgress() {
    if (!currentUser) return;
    
    try {
        const snapshot = await db.ref(`projects/${PROJECT_NAME}/users/${currentUser.uid}/progress`).once('value');
        const progress = snapshot.val();
        
        if (progress) {
            userProgress = {
                pronunciationScores: progress.pronunciationScores || [],
                practiceScores: progress.practiceScores || [],
                difficultWords: progress.difficultWords || {},
                totalPracticeTime: progress.totalPracticeTime || 0,
                lastPracticeDate: progress.lastPracticeDate || null
            };
        }
    } catch (error) {
        console.error('Error cargando progreso:', error);
    }
}

async function saveUserProgress() {
    if (!currentUser) return;
    
    try {
        await db.ref(`projects/${PROJECT_NAME}/users/${currentUser.uid}/progress`).set(userProgress);
    } catch (error) {
        console.error('Error guardando progreso:', error);
    }
}

async function loadPronunciation() {
    const area = document.getElementById('pronunciation-area');
    area.innerHTML = `
        <h2 style="margin-bottom:1.5rem;color:#2d3748;">🎯 Práctica de Pronunciación</h2>
        <div style="margin-bottom:2rem;">
            <button onclick="loadPronunciationLevel(1)" class="practice-btn" style="margin:0.5rem;">Nivel 1 - Básico</button>
            <button onclick="loadPronunciationLevel(2)" class="practice-btn" style="margin:0.5rem;">Nivel 2 - Intermedio</button>
            <button onclick="loadPronunciationLevel(3)" class="practice-btn" style="margin:0.5rem;">Nivel 3 - Avanzado</button>
        </div>
        <div id="pronunciation-exercise" style="text-align:center;color:#666;padding:2rem;">
            <p>👆 Selecciona un nivel para comenzar</p>
        </div>
    `;
}

async function loadPronunciationLevel(level) {
    if (!apiKey) {
        alert('⚠️ Configura tu API key primero en la pestaña Config');
        return;
    }
    
    const exerciseDiv = document.getElementById('pronunciation-exercise');
    exerciseDiv.innerHTML = '<p style="color:#3498db;text-align:center;">⏳ Generando oración...</p>';
    
    try {
        const levelDesc = level === 1 ? '5-7 words, basic DevOps/Cloud vocabulary' : level === 2 ? '8-12 words, intermediate DevOps/Cloud concepts' : '13-18 words, advanced DevOps/Cloud scenarios';
        
        await apiRateLimiter.waitIfNeeded();
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate ONE English sentence about DevOps/Cloud/Infrastructure. Level ${level} (${levelDesc}). Only respond with the sentence, nothing else.` }] }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 50
                }
            })
        });
        
        const data = await response.json();
        const sentence = data.candidates[0].content.parts[0].text.trim().replace(/["']/g, '');
        
        currentPronunciationSentence = { level, text: sentence };
        
        exerciseDiv.innerHTML = `
            <div class="practice-card">
                <h3>Lee esta oración en voz alta:</h3>
                <p style="font-size:1.5rem;margin:1.5rem 0;font-weight:600;color:#667eea;line-height:1.8;">${currentPronunciationSentence.text}</p>
                <div id="live-transcript" style="min-height:2rem;padding:0.5rem;background:#f8f9fa;border-radius:8px;margin-bottom:1rem;color:#666;font-style:italic;"></div>
                
                <div style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;">
                    <button onclick="recordPronunciation()" class="practice-btn" id="record-pronunciation-btn">🎤 Grabar Mi Voz</button>
                    <button onclick="playPronunciationModel()" class="practice-btn" style="background:linear-gradient(135deg, #11998e 0%, #38ef7d 100%);" id="play-model-btn" disabled>🔊 Escuchar Modelo</button>
                </div>
                
                <div id="pronunciation-result" style="margin-top:1.5rem;"></div>
            </div>
        `;
    } catch (error) {
        exerciseDiv.innerHTML = '<p style="color:#e74c3c;">❌ Error generando oración. Verifica tu API key.</p>';
    }
}

function playPronunciationModel() {
    if (!synthesis) return;
    synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(currentPronunciationSentence.text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    
    const voices = synthesis.getVoices();
    const nativeVoice = voices.find(v => v.lang === 'en-US' && v.localService);
    if (nativeVoice) utterance.voice = nativeVoice;
    
    synthesis.speak(utterance);
}

function recordPronunciation() {
    if (!recognition) {
        alert('❌ Reconocimiento de voz no disponible en este navegador');
        return;
    }
    
    const btn = document.getElementById('record-pronunciation-btn');
    const resultDiv = document.getElementById('pronunciation-result');
    const liveTranscript = document.getElementById('live-transcript');
    
    synthesis.cancel();
    
    if (pronunciationRecognition) {
        pronunciationRecognition.stop();
        pronunciationRecognition = null;
        btn.textContent = '🎤 Grabar Mi Voz';
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    pronunciationRecognition = new SpeechRecognition();
    pronunciationRecognition.lang = 'en-US';
    pronunciationRecognition.continuous = false;
    pronunciationRecognition.interimResults = true;
    
    btn.textContent = '🔴 Grabando...';
    resultDiv.innerHTML = '';
    liveTranscript.textContent = '🎤 Escuchando...';
    
    pronunciationRecognition.onresult = async (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        liveTranscript.textContent = transcript || '🎤 Escuchando...';
        
        if (event.results[event.results.length - 1].isFinal) {
            const confidence = event.results[event.results.length - 1][0].confidence;
            btn.textContent = '🎤 Grabar Mi Voz';
            pronunciationRecognition = null;
            await evaluatePronunciationMatch(transcript, confidence);
        }
    };
    
    pronunciationRecognition.onerror = (event) => {
        btn.textContent = '🎤 Grabar Mi Voz';
        pronunciationRecognition = null;
        liveTranscript.textContent = '';
        
        const errorMessages = {
            'no-speech': '🔇 No se detectó voz. Habla más cerca del micrófono.',
            'audio-capture': '🎤 No se puede acceder al micrófono. Verifica que esté conectado.',
            'not-allowed': '⛔ Permiso denegado. Habilita el micrófono en la configuración del navegador (click en el candado 🔒).',
            'network': '🌐 Error de conexión. Verifica tu internet.',
            'aborted': '⏹️ Grabación cancelada.',
            'service-not-allowed': '🚫 Servicio bloqueado por el navegador.'
        };
        
        const message = errorMessages[event.error] || `❌ Error: ${event.error}. Intenta de nuevo.`;
        resultDiv.innerHTML = `<p style="color:#e74c3c;">${message}</p>`;
        
        console.error('Speech recognition error:', event.error, event);
    };
    
    pronunciationRecognition.onend = () => {
        btn.textContent = '🎤 Grabar Mi Voz';
        pronunciationRecognition = null;
    };
    
    pronunciationRecognition.start();
}

async function evaluatePronunciationMatch(transcript, confidence) {
    const resultDiv = document.getElementById('pronunciation-result');
    const playModelBtn = document.getElementById('play-model-btn');
    
    if (!apiKey) {
        resultDiv.innerHTML = '<p style="color:#e74c3c;">❌ Configura tu API key primero</p>';
        return;
    }
    
    if (!currentPronunciationSentence || !currentPronunciationSentence.text) {
        resultDiv.innerHTML = '<p style="color:#e74c3c;">❌ Error: No hay oración para evaluar</p>';
        return;
    }
    
    // Verificar rate limit
    if (!apiRateLimiter.canMakeRequest()) {
        const waitTime = apiRateLimiter.getWaitTime();
        resultDiv.innerHTML = `
            <p style="color:#f59e0b;">⏳ <strong>Espera ${waitTime}s</strong></p>
            <p style="color:#666;font-size:0.9rem;">Límite de ${apiRateLimiter.maxPerMinute} evaluaciones por minuto alcanzado.</p>
        `;
        playModelBtn.disabled = false;
        return;
    }
    
    // Verificar caché
    const cacheKey = `${currentPronunciationSentence.text}|${transcript.toLowerCase()}`;
    if (evaluationCache.has(cacheKey)) {
        const cached = evaluationCache.get(cacheKey);
        displayEvaluationResult(cached, transcript, resultDiv, playModelBtn);
        return;
    }
    
    resultDiv.innerHTML = '<p style="color:#3498db;">⏳ Evaluando pronunciación...</p>';
    apiRateLimiter.addRequest();
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Evaluate pronunciation accuracy. Original: "${currentPronunciationSentence.text}". Spoken: "${transcript}". Compare word by word strictly. Respond in JSON format: {"score": 0-100, "correctWords": ["word1"], "incorrectWords": ["word2"], "phonetic": "simple phonetic guide for Spanish speakers (example: cloud = claud, infrastructure = infrastrukchur)", "translation": "traducción al español", "feedback": "brief feedback in Spanish"}` }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 300
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API HTTP Error:', response.status, errorData);
            resultDiv.innerHTML = `<p style="color:#e74c3c;">❌ Error ${response.status}: ${errorData.error?.message || 'Error de API'}</p>`;
            return;
        }
        
        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2));
        console.log('Has candidates?', !!data.candidates);
        console.log('Candidates length:', data.candidates?.length);
        
        if (!data.candidates || !data.candidates[0]) {
            console.error('No candidates in response');
            console.error('Full response:', JSON.stringify(data, null, 2));
            const errorMsg = data.error?.message || data.promptFeedback?.blockReason || 'La API no devolvió resultados. Posible bloqueo por contenido.';
            resultDiv.innerHTML = `<p style="color:#e74c3c;">❌ Error: ${errorMsg}</p>`;
            playModelBtn.disabled = false;
            return;
        }
        
        if (!data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
            console.error('Invalid response structure:', data.candidates[0]);
            resultDiv.innerHTML = '<p style="color:#e74c3c;">❌ Error: Respuesta inválida de la API</p>';
            return;
        }
        
        const aiResponse = data.candidates[0].content.parts[0].text.trim();
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        let evaluation;
        try {
            evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 70, correctWords: [], incorrectWords: [], phonetic: 'N/A', translation: 'N/A', feedback: 'Evaluación completada' };
            
            // Validar y normalizar la respuesta
            if (typeof evaluation.phonetic !== 'string') evaluation.phonetic = 'N/A';
            if (typeof evaluation.translation !== 'string') evaluation.translation = 'N/A';
            if (!Array.isArray(evaluation.correctWords)) evaluation.correctWords = [];
            if (!Array.isArray(evaluation.incorrectWords)) evaluation.incorrectWords = [];
            if (typeof evaluation.feedback !== 'string') evaluation.feedback = 'Evaluación completada';
            if (typeof evaluation.score !== 'number') evaluation.score = 70;
        } catch (e) {
            console.error('Error parsing evaluation JSON:', e);
            evaluation = { score: 70, correctWords: [], incorrectWords: [], phonetic: 'N/A', translation: 'N/A', feedback: 'Error en evaluación' };
        }
        
        const finalScore = evaluation.score;
        let color, emoji;
        if (finalScore >= 85) {
            color = '#10b981';
            emoji = '🎉';
        } else if (finalScore >= 70) {
            color = '#f59e0b';
            emoji = '👍';
        } else {
            color = '#ef4444';
            emoji = '💪';
        }
        
        playModelBtn.disabled = false;
        
        const originalWords = currentPronunciationSentence.text.toLowerCase().replace(/[.,!?;:]/g, '').split(' ').filter(w => w.trim());
        let wordsHtml = '<div style="margin:1rem 0;display:flex;flex-wrap:wrap;gap:0.5rem;">';
        originalWords.forEach(word => {
            const cleanWord = word.trim();
            if (!cleanWord) return;
            
            const isCorrect = Array.isArray(evaluation.correctWords) && evaluation.correctWords.some(w => 
                w && typeof w === 'string' && w.toLowerCase().replace(/[.,!?;:]/g, '') === cleanWord
            );
            const isIncorrect = Array.isArray(evaluation.incorrectWords) && evaluation.incorrectWords.some(w => 
                w && typeof w === 'string' && w.toLowerCase().replace(/[.,!?;:]/g, '') === cleanWord
            );
            
            if (isCorrect) {
                wordsHtml += `<span style="color:#10b981;">✅ ${cleanWord}</span>`;
            } else if (isIncorrect) {
                wordsHtml += `<span style="color:#ef4444;">❌ ${cleanWord}</span>`;
            } else {
                wordsHtml += `<span style="color:#10b981;">✅ ${cleanWord}</span>`;
            }
        });
        wordsHtml += '</div>';
        
        // Guardar en caché
        evaluationCache.set(cacheKey, { evaluation, finalScore, color, emoji, wordsHtml });
        
        // Guardar progreso
        userProgress.pronunciationScores.push(finalScore);
        if (Array.isArray(evaluation.incorrectWords)) {
            evaluation.incorrectWords.forEach(word => {
                if (word && typeof word === 'string') {
                    const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, '').trim();
                    if (cleanWord) {
                        userProgress.difficultWords[cleanWord] = (userProgress.difficultWords[cleanWord] || 0) + 1;
                    }
                }
            });
        }
        userProgress.lastPracticeDate = new Date().toISOString();
        await saveUserProgress();
        
        displayEvaluationResult({ evaluation, finalScore, color, emoji, wordsHtml }, transcript, resultDiv, playModelBtn);
    } catch (error) {
        console.error('Evaluation error:', error);
        resultDiv.innerHTML = '<p style="color:#e74c3c;">❌ Error al evaluar. Intenta de nuevo.</p>';
        playModelBtn.disabled = false;
    }
}

function displayEvaluationResult(data, transcript, resultDiv, playModelBtn) {
    const { evaluation, finalScore, color, emoji, wordsHtml } = data;
    
    playModelBtn.disabled = false;
    
    resultDiv.innerHTML = `
        <div style="background:${color}15;padding:1.5rem;border-radius:8px;border-left:4px solid ${color};">
            <p style="font-size:1.2rem;margin-bottom:1rem;color:${color};"><strong>${emoji} Puntuación: ${finalScore}%</strong></p>
            <p style="margin-bottom:0.5rem;"><strong>Dijiste:</strong> "${transcript}"</p>
            <p style="margin-bottom:0.5rem;"><strong>Original:</strong> "${currentPronunciationSentence.text}"</p>
            <p style="margin-bottom:0.5rem;color:#666;font-size:0.95rem;"><strong>📖 Traducción:</strong> ${String(evaluation.translation || 'N/A')}</p>
            <p style="margin-bottom:1rem;color:#666;font-size:1rem;word-break:break-word;line-height:1.6;"><strong>🔊 Cómo se pronuncia:</strong><br><span style="color:#667eea;font-weight:500;">${String(evaluation.phonetic || 'N/A')}</span></p>
            ${wordsHtml}
            <p style="color:#666;margin-bottom:1rem;">${evaluation.feedback}</p>
            <button onclick="loadPronunciationLevel(${currentPronunciationSentence.level})" class="practice-btn" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">✨ Siguiente Oración</button>
        </div>
    `;
}

function loadRandomSentence() {
    currentSentence = PRACTICE_SENTENCES[Math.floor(Math.random() * PRACTICE_SENTENCES.length)];
    const practiceArea = document.getElementById('practice-area');
    practiceArea.innerHTML = `
        <h2 style="margin-bottom:1.5rem;color:#2d3748;">✍️ Práctica de Traducción</h2>
        <div class="practice-card">
            <h3>Traduce al inglés:</h3>
            <p style="font-size:1.1rem;margin:1rem 0;"><strong>"${currentSentence.es}"</strong></p>
            <input type="text" id="practice-input" class="practice-input" placeholder="Tu respuesta...">
            <button onclick="checkAnswer()" class="practice-btn">Verificar</button>
            <div id="practice-result" style="margin-top:1rem;"></div>
        </div>
    `;
}

async function checkAnswer() {
    const input = document.getElementById('practice-input').value.trim();
    const result = document.getElementById('practice-result');
    
    if (!input) { result.innerHTML = '<p style="color:#e74c3c;">⚠️ Escribe tu traducción</p>'; return; }
    if (!apiKey) { result.innerHTML = '<p style="color:#e74c3c;">⚠️ Configura tu API key primero</p>'; return; }
    
    result.innerHTML = '<p style="color:#3498db;">⏳ Verificando...</p>';
    
    const prompt = `El estudiante tradujo: "${input}". La frase original en español es: "${currentSentence.es}". La traducción correcta es: "${currentSentence.en}". Evalúa si la traducción del estudiante es correcta o tiene errores. Da feedback breve en español.`;
    
    try {
        trackApiRequest();
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 300
                }
            })
        });
        
        const data = await response.json();
        const feedback = data.candidates[0].content.parts[0].text;
        
        result.innerHTML = `
            <div style="background:#f8f9fa;padding:1.5rem;border-radius:8px;border-left:4px solid #667eea;">
                <p style="margin-bottom:1rem;"><strong>📝 Feedback:</strong></p>
                <p style="margin-bottom:1rem;">${feedback}</p>
                <p style="color:#666;font-size:0.9rem;margin-bottom:1rem;"><strong>Traducción correcta:</strong> "${currentSentence.en}"</p>
                <button onclick="loadRandomSentence()" class="practice-btn" style="background:linear-gradient(135deg, #11998e 0%, #38ef7d 100%);">✨ Siguiente Frase</button>
            </div>
        `;
    } catch (error) {
        result.innerHTML = '<p style="color:#e74c3c;">❌ Error al verificar. Intenta de nuevo.</p>';
    }
}

function encryptApiKey(text, password) {
    const salt = CryptoJS.lib.WordArray.random(128/8);
    const key = CryptoJS.PBKDF2(password, salt, { keySize: 256/32 });
    const iv = CryptoJS.lib.WordArray.random(128/8);
    const encrypted = CryptoJS.AES.encrypt(text, key, { iv: iv });
    return salt.toString() + iv.toString() + encrypted.toString();
}

async function saveApiKey() {
    if (!currentUser) { 
        alert('Debes iniciar sesión primero'); 
        return; 
    }
    
    const apiKeyInput = document.getElementById('api-key-input').value.trim();
    const status = document.getElementById('config-status');
    
    if (!apiKeyInput) {
        status.innerHTML = '<p style="color:red;">⚠️ Ingresa tu API key</p>';
        return;
    }
    
    // Solicitar contraseña para encriptar
    const passwordInput = prompt('Crea una contraseña para proteger tu API key (mínimo 8 caracteres):');
    
    if (!passwordInput || passwordInput.length < 8) {
        status.innerHTML = '<p style="color:red;">⚠️ La contraseña debe tener al menos 8 caracteres</p>';
        return;
    }
    
    try {
        const encrypted = encryptApiKey(apiKeyInput, passwordInput);
        await db.ref(`projects/${PROJECT_NAME}/users/${currentUser.uid}/config/api_key_encrypted`).set(encrypted);
        
        sessionStorage.setItem('gemini_password', passwordInput);
        apiKey = apiKeyInput;
        
        status.innerHTML = '<p style="color:green;">✅ API key guardada correctamente y encriptada</p>';
        document.getElementById('api-key-input').value = '';
    } catch (error) {
        status.innerHTML = '<p style="color:red;">⚠️ Error guardando API key: ' + error.message + '</p>';
    }
}

async function loadConfig() {
    if (!currentUser) {
        document.getElementById('config-status').innerHTML = '<p style="color:orange;">⚠️ Inicia sesión para configurar tu API key</p>';
        return;
    }
    
    const status = document.getElementById('config-status');
    const modelSelector = document.getElementById('model-selector');
    
    // Actualizar display de uso
    updateUsageDisplay();
    
    try {
        // Cargar modelo guardado
        const modelSnapshot = await db.ref(`projects/${PROJECT_NAME}/users/${currentUser.uid}/config/selected_model`).once('value');
        const savedModel = modelSnapshot.val();
        if (savedModel && modelSelector) {
            modelSelector.value = savedModel;
            selectedModel = savedModel;
            document.getElementById('model-status').innerHTML = `<span style="color:#10b981;">✅ Usando: ${savedModel}</span>`;
        }
        
        // Verificar API key
        const snapshot = await db.ref(`projects/${PROJECT_NAME}/users/${currentUser.uid}/config/api_key_encrypted`).once('value');
        
        if (snapshot.val()) {
            status.innerHTML = '<p style="color:green;">✅ API key configurada y encriptada</p>';
        } else {
            status.innerHTML = '<p style="color:orange;">⚠️ No hay API key configurada</p>';
        }
    } catch (error) {
        status.innerHTML = '<p style="color:red;">⚠️ Error verificando configuración</p>';
    }
}

window.changeModel = async function() {
    if (!currentUser) {
        alert('⚠️ Inicia sesión primero');
        return;
    }
    
    const modelSelector = document.getElementById('model-selector');
    const newModel = modelSelector.value;
    
    try {
        await db.ref(`projects/${PROJECT_NAME}/users/${currentUser.uid}/config/selected_model`).set(newModel);
        selectedModel = newModel;
        document.getElementById('model-status').innerHTML = `<span style="color:#10b981;">✅ Modelo cambiado a: ${newModel}</span>`;
        updateUsageDisplay();
    } catch (error) {
        document.getElementById('model-status').innerHTML = `<span style="color:#ef4444;">❌ Error: ${error.message}</span>`;
    }
}

// ===== LISTENING PRACTICE =====
let currentListeningSentence = null;
let listeningRecognition = null;
let userTranscript = '';

async function loadListening() {
    const area = document.getElementById('listening-area');
    area.innerHTML = `
        <h2 style="margin-bottom:1.5rem;color:#2d3748;">🎧 Práctica de Listening</h2>
        <div style="margin-bottom:2rem;">
            <button onclick="loadListeningLevel(1)" class="practice-btn" style="margin:0.5rem;">Nivel 1 - Básico</button>
            <button onclick="loadListeningLevel(2)" class="practice-btn" style="margin:0.5rem;">Nivel 2 - Intermedio</button>
            <button onclick="loadListeningLevel(3)" class="practice-btn" style="margin:0.5rem;">Nivel 3 - Avanzado</button>
        </div>
        <div id="listening-exercise" style="text-align:center;color:#666;padding:2rem;">
            <p>👆 Selecciona un nivel para comenzar</p>
        </div>
    `;
}

async function loadListeningLevel(level) {
    if (!apiKey) {
        alert('⚠️ Configura tu API key primero en la pestaña Config');
        return;
    }
    
    const exerciseDiv = document.getElementById('listening-exercise');
    exerciseDiv.innerHTML = '<p style="color:#3498db;text-align:center;">⏳ Generando oración...</p>';
    
    try {
        const levelDesc = level === 1 ? '5-7 words, basic DevOps/Cloud vocabulary' : level === 2 ? '8-12 words, intermediate DevOps/Cloud concepts' : '13-18 words, advanced DevOps/Cloud scenarios';
        
        await apiRateLimiter.waitIfNeeded();
        
        const randomSeed = Date.now() + Math.random();
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate ONE unique English sentence about DevOps/Cloud/Infrastructure. Level ${level} (${levelDesc}). Random seed: ${randomSeed}. Make it different each time. Only respond with the sentence, nothing else.` }] }],
                generationConfig: {
                    temperature: 1.0,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 50
                }
            })
        });
        
        const data = await response.json();
        const sentence = data.candidates[0].content.parts[0].text.trim().replace(/[\"']/g, '');
        
        // Obtener traducción
        const translationResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Translate this English text to Spanish: "${sentence}". Only respond with the translation.` }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 100
                }
            })
        });
        
        const translationData = await translationResponse.json();
        const translation = translationData.candidates[0].content.parts[0].text.trim();
        
        currentListeningSentence = { level, text: sentence, translation };
        userTranscript = '';
        
        exerciseDiv.innerHTML = `
            <div class="practice-card">
                <h3>🎧 Escucha y escribe lo que oyes:</h3>
                
                <div style="margin:2rem 0;">
                    <button onclick="playListeningAudio()" class="practice-btn" style="background:linear-gradient(135deg, #11998e 0%, #38ef7d 100%);font-size:1.2rem;padding:1rem 2rem;">
                        🔊 Reproducir Audio
                    </button>
                </div>
                
                <div style="margin:1.5rem 0;">
                    <label style="display:block;margin-bottom:0.5rem;font-weight:600;color:#2d3748;">✍️ Escribe lo que escuchaste:</label>
                    <textarea id="listening-text-input" placeholder="Escribe aquí lo que oyes..." style="width:100%;padding:1rem;border:2px solid #e2e8f0;border-radius:8px;font-size:1rem;min-height:80px;resize:vertical;" oninput="updateListeningTranscript()"></textarea>
                </div>
                
                <div id="live-listening-transcript" style="min-height:2rem;padding:0.75rem;background:#f8f9fa;border-radius:8px;margin:1rem 0;color:#94a3b8;font-style:italic;font-size:0.9rem;">
                    💡 Puedes escribir manualmente o usar el botón de voz
                </div>
                
                <div style="display:flex;gap:1rem;margin:1.5rem 0;flex-wrap:wrap;">
                    <button onclick="startListeningRecording()" class="practice-btn" id="listening-record-btn">🎤 Dictar con Voz</button>
                    <button onclick="finishListening()" class="practice-btn" style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);" id="finish-listening-btn">✅ Verificar Respuesta</button>
                </div>
                
                <div id="listening-result" style="margin-top:1.5rem;"></div>
            </div>
        `;
    } catch (error) {
        exerciseDiv.innerHTML = '<p style="color:#e74c3c;">❌ Error generando oración. Verifica tu API key.</p>';
    }
}

function playListeningAudio() {
    if (!synthesis || !currentListeningSentence) return;
    
    synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(currentListeningSentence.text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    utterance.pitch = 1.0;
    
    const voices = synthesis.getVoices();
    const nativeVoice = voices.find(v => v.lang === 'en-US' && v.localService);
    if (nativeVoice) utterance.voice = nativeVoice;
    
    synthesis.speak(utterance);
}

window.updateListeningTranscript = function() {
    const textInput = document.getElementById('listening-text-input');
    const liveTranscript = document.getElementById('live-listening-transcript');
    if (textInput && liveTranscript) {
        userTranscript = textInput.value.trim();
        if (userTranscript) {
            liveTranscript.innerHTML = `<span style="color:#10b981;">✍️ ${userTranscript.length} caracteres escritos</span>`;
        } else {
            liveTranscript.innerHTML = '💡 Puedes escribir manualmente o usar el botón de voz';
        }
    }
}

function startListeningRecording() {
    if (!recognition) {
        alert('❌ Reconocimiento de voz no disponible en este navegador');
        return;
    }
    
    const btn = document.getElementById('listening-record-btn');
    const liveTranscript = document.getElementById('live-listening-transcript');
    const textInput = document.getElementById('listening-text-input');
    
    synthesis.cancel();
    
    if (listeningRecognition) {
        listeningRecognition.stop();
        listeningRecognition = null;
        btn.textContent = '🎤 Dictar con Voz';
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    listeningRecognition = new SpeechRecognition();
    listeningRecognition.lang = 'en-US';
    listeningRecognition.continuous = true;
    listeningRecognition.interimResults = true;
    
    btn.textContent = '🔴 Grabando... (Click para detener)';
    liveTranscript.innerHTML = '<span style="color:#3498db;">🎤 Escuchando...</span>';
    
    listeningRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript + ' ';
        }
        userTranscript = transcript.trim();
        textInput.value = userTranscript;
        liveTranscript.innerHTML = `<span style="color:#10b981;">🎤 ${userTranscript}</span>`;
    };
    
    listeningRecognition.onerror = (event) => {
        btn.textContent = '🎤 Dictar con Voz';
        listeningRecognition = null;
        
        const errorMessages = {
            'no-speech': '🔇 No se detectó voz. Habla más cerca del micrófono.',
            'audio-capture': '🎤 No se puede acceder al micrófono.',
            'not-allowed': '⛔ Permiso denegado. Habilita el micrófono.',
            'network': '🌐 Error de conexión.',
            'aborted': '⏹️ Grabación cancelada.'
        };
        
        const message = errorMessages[event.error] || `❌ Error: ${event.error}`;
        liveTranscript.innerHTML = `<span style="color:#e74c3c;">${message}</span>`;
    };
    
    listeningRecognition.onend = () => {
        if (listeningRecognition) {
            btn.textContent = '🎤 Dictar con Voz';
            listeningRecognition = null;
        }
    };
    
    listeningRecognition.start();
}

function finishListening() {
    const textInput = document.getElementById('listening-text-input');
    userTranscript = textInput ? textInput.value.trim() : userTranscript;
    
    if (!currentListeningSentence || !userTranscript) {
        alert('⚠️ Primero escucha el audio y escribe lo que oyes');
        return;
    }
    
    const resultDiv = document.getElementById('listening-result');
    const originalWords = currentListeningSentence.text.toLowerCase().replace(/[.,!?;:]/g, '').split(' ').filter(w => w.trim());
    const userWords = userTranscript.toLowerCase().replace(/[.,!?;:]/g, '').split(' ').filter(w => w.trim());
    
    let correctCount = 0;
    let comparisonHtml = '<div style="margin:1rem 0;line-height:2.5;">';
    
    const maxLength = Math.max(originalWords.length, userWords.length);
    
    for (let i = 0; i < maxLength; i++) {
        const originalWord = originalWords[i] || '';
        const userWord = userWords[i] || '';
        
        if (originalWord === userWord) {
            correctCount++;
            comparisonHtml += `<span style="background:#10b98120;color:#10b981;padding:0.5rem 0.75rem;margin:0.25rem;border-radius:8px;display:inline-block;font-weight:500;">✅ ${originalWord}</span> `;
        } else if (userWord) {
            comparisonHtml += `<span style="background:#ef444420;color:#ef4444;padding:0.5rem 0.75rem;margin:0.25rem;border-radius:8px;display:inline-block;font-weight:500;text-decoration:line-through;">❌ ${userWord}</span> `;
            comparisonHtml += `<span style="background:#3498db20;color:#3498db;padding:0.5rem 0.75rem;margin:0.25rem;border-radius:8px;display:inline-block;font-weight:500;">➡️ ${originalWord}</span> `;
        } else {
            comparisonHtml += `<span style="background:#f59e0b20;color:#f59e0b;padding:0.5rem 0.75rem;margin:0.25rem;border-radius:8px;display:inline-block;font-weight:500;">⚠️ ${originalWord}</span> `;
        }
    }
    
    comparisonHtml += '</div>';
    
    const score = Math.round((correctCount / originalWords.length) * 100);
    let color, emoji;
    
    if (score >= 85) {
        color = '#10b981';
        emoji = '🎉';
    } else if (score >= 70) {
        color = '#f59e0b';
        emoji = '👍';
    } else {
        color = '#ef4444';
        emoji = '💪';
    }
    
    // Guardar progreso
    if (!userProgress.listeningScores) userProgress.listeningScores = [];
    userProgress.listeningScores.push(score);
    saveUserProgress();
    
    resultDiv.innerHTML = `
        <div style="background:${color}15;padding:2rem;border-radius:12px;border-left:4px solid ${color};">
            <p style="font-size:1.5rem;margin-bottom:1rem;color:${color};text-align:center;"><strong>${emoji} Puntuación: ${score}%</strong></p>
            
            <div style="background:white;padding:1.5rem;border-radius:8px;margin:1rem 0;">
                <p style="margin-bottom:0.5rem;color:#666;font-weight:600;">📝 Lo que escribiste:</p>
                <p style="font-size:1.1rem;color:#2d3748;margin-bottom:1rem;">${userTranscript}</p>
                
                <p style="margin-bottom:0.5rem;color:#666;font-weight:600;">✅ Oración correcta:</p>
                <p style="font-size:1.1rem;color:#667eea;font-weight:500;margin-bottom:1rem;">${currentListeningSentence.text}</p>
                
                <p style="margin-bottom:0.5rem;color:#666;font-weight:600;">🇪🇸 Traducción al español:</p>
                <p style="font-size:1.05rem;color:#2d3748;font-style:italic;">${currentListeningSentence.translation}</p>
            </div>
            
            <div style="background:white;padding:1.5rem;border-radius:8px;margin:1rem 0;">
                <p style="margin-bottom:1rem;color:#666;font-weight:600;">🔍 Comparación palabra por palabra:</p>
                ${comparisonHtml}
                <p style="margin-top:1rem;color:#666;font-size:0.9rem;">
                    <strong>Leyenda:</strong> 
                    <span style="color:#10b981;">✅ Correcta</span> | 
                    <span style="color:#ef4444;">❌ Tu palabra</span> | 
                    <span style="color:#3498db;">➡️ Debería ser</span> | 
                    <span style="color:#f59e0b;">⚠️ Faltante</span>
                </p>
            </div>
            
            <div style="display:flex;gap:1rem;margin-top:1.5rem;flex-wrap:wrap;">
                <button onclick="playListeningAudio()" class="practice-btn" style="background:linear-gradient(135deg, #11998e 0%, #38ef7d 100%);">🔊 Escuchar de Nuevo</button>
                <button onclick="loadListeningLevel(${currentListeningSentence.level})" class="practice-btn" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">✨ Siguiente Oración</button>
            </div>
        </div>
    `;
}





