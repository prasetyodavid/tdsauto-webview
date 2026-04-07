// ====================================================================
// TILE MASTER - CLEAN & ORGANIZED CODE (Performance Optimized)
// Updated Asset Paths: All assets are now located in the 'assets/' folder.
// ====================================================================

// ===== CONFIGURATION CONSTANTS =====
const CONFIG = {
    // UI Dimensions
    TILE_SIZE: {
        DEFAULT: 56,
        DOCK: 42,
        MINI: 12,
        MAX: 65,
        MIN: 30
    },
    
    // Game Limits
    DOCK: {
        MAX: 7,
        WARNING_THRESHOLD: 6
    },
    
    // Layout Grid
    LAYOUT: {
        COUNT: 10,
        GAP_X: 3,
        GAP_Y: 5,
        MINI_GAP_X: 2,
        MINI_GAP_Y: 2,
        MAX_CONTAINER_SIZE: 70
    },
    
    // Animation Durations (ms)
    ANIMATION: {
        TILE_FLY: 300,
        MODAL_POP: 400,
        STAR_POP: 500,
        TOAST_SHOW: 2000,
        SAVE_THROTTLE: 500
    },
    
    // Audio Files - Updated Paths
    AUDIO: {
        BUTTON_CLICK: 'assets/voice/Button%20sound.mp3',
        TILE_TAP: 'assets/voice/The%20sound%20of%20tapping%20on%20the%20tile.mp3',
        WIN_LOSE: 'assets/voice/Win%20or%20lose.mp3'
    },
    
    // Storage
    STORAGE: {
        KEY: 'tileMaster_save_v1',
        VERSION: '1.1.0'
    },
    
    // Accessibility
    A11Y: {
        SKIP_LINK: '#main-content',
        FOCUS_VISIBLE: 'focus-visible'
    }
};

// ===== AUDIO MANAGER =====
const AudioManager = {
    sounds: {},
    isAudioEnabled: true,
    isInitialized: false,
    userInteracted: false,
    
    async init() {
        try {
            // Preload all sounds
            for (const [key, path] of Object.entries(CONFIG.AUDIO)) {
                const audio = new Audio(path);
                audio.preload = 'auto';
                audio.volume = 0.7;
                
                // Handle loading errors gracefully
                audio.addEventListener('error', (e) => {
                    console.warn(`Failed to load audio: ${path}`, e);
                });
                
                // Mark as loaded when ready
                audio.addEventListener('canplaythrough', () => {
                    console.log(`Audio loaded: ${key}`);
                });
                
                this.sounds[key] = audio;
            }
            
            // Unlock HTML5 Audio on first user gesture (required on many WebViews). Set flags
            // synchronously so handlers on the same event (e.g. gameBoard pointerdown) can call play().
            const removeUnlockListeners = () => {
                document.removeEventListener('click', unlockAndEnable);
                document.removeEventListener('keydown', unlockAndEnable);
                document.removeEventListener('touchstart', unlockAndEnable);
                document.removeEventListener('pointerdown', unlockAndEnable, true);
            };

            const unlockAndEnable = () => {
                this.userInteracted = true;
                this.isInitialized = true;
                removeUnlockListeners();
                for (const audio of Object.values(this.sounds)) {
                    try {
                        audio.muted = true;
                        audio.volume = 0;
                        const p = audio.play();
                        if (p !== undefined) {
                            p.then(() => {
                                audio.pause();
                                audio.currentTime = 0;
                                audio.muted = false;
                                audio.volume = 0.7;
                            }).catch(() => {
                                audio.muted = false;
                                audio.volume = 0.7;
                            });
                        } else {
                            audio.pause();
                            audio.currentTime = 0;
                            audio.muted = false;
                            audio.volume = 0.7;
                        }
                    } catch (_) {
                        audio.muted = false;
                        audio.volume = 0.7;
                    }
                }
            };

            document.addEventListener('click', unlockAndEnable, { once: true });
            document.addEventListener('keydown', unlockAndEnable, { once: true });
            document.addEventListener('touchstart', unlockAndEnable, { once: true, passive: true });
            // Capture phase runs before bubble handlers on #gameBoard so unlock runs first.
            document.addEventListener('pointerdown', unlockAndEnable, { once: true, capture: true });
            
        } catch (error) {
            console.error('Audio initialization failed:', error);
            this.isAudioEnabled = false;
        }
    },
    
    play(soundKey) {
        // Don't play if not enabled or not initialized
        if (!this.isAudioEnabled || !this.isInitialized) {
            return;
        }
        
        // Check if sound is enabled in settings
        const soundCheck = document.getElementById('soundCheck');
        if (soundCheck && !soundCheck.checked) {
            return;
        }
        
        const template = this.sounds[soundKey];
        if (!template) {
            console.warn(`Sound not found: ${soundKey}`);
            return;
        }

        // Play a clone so rapid taps do not AbortError the same element (common in WebView).
        // The shared nodes in `sounds` stay available for unlock/preload.
        let sound;
        try {
            sound = template.cloneNode();
            sound.volume = template.volume;
        } catch (_) {
            sound = template;
            sound.currentTime = 0;
        }

        try {
            const playPromise = sound.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    /* WebView often rejects with DOMException and no stable .name — avoid noisy logs */
                });
            }
        } catch (_) {
            /* sync throw from play() — ignore */
        }
    },
    
    enable() {
        this.isAudioEnabled = true;
    },
    
    disable() {
        this.isAudioEnabled = false;
    },
    
    // Test audio playback
    async testPlayback() {
        if (!this.sounds.BUTTON_CLICK) return false;
        
        try {
            const testAudio = this.sounds.BUTTON_CLICK.cloneNode();
            testAudio.volume = 0;
            await testAudio.play();
            return true;
        } catch (error) {
            return false;
        }
    }
};

// ===== STORAGE MANAGER =====
const StorageManager = {
    currentVersion: CONFIG.STORAGE.VERSION,
    
    init() {
        this.checkVersion();
    },
    
    checkVersion() {
        const saved = localStorage.getItem(CONFIG.STORAGE.KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                const savedVersion = data.version || '0.0.0';
                
                if (this.compareVersions(savedVersion, this.currentVersion) < 0) {
                    this.migrateData(savedVersion, data);
                }
            } catch (error) {
                console.error('Failed to check storage version:', error);
                this.clearCorruptedData();
            }
        }
    },
    
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const part1 = parts1[i] || 0;
            const part2 = parts2[i] || 0;
            
            if (part1 < part2) return -1;
            if (part1 > part2) return 1;
        }
        
        return 0;
    },
    
    migrateData(fromVersion, data) {
        console.log(`Migrating data from version ${fromVersion} to ${this.currentVersion}`);
        
        // Example migration logic
        switch (fromVersion) {
            case '0.0.0':
                // Add new properties
                if (!data.userCoins) data.userCoins = 100;
                if (!data.magicCount) data.magicCount = 5;
                if (!data.undoCount) data.undoCount = 5;
                break;
                
            case '1.0.0':
                if (!data.stats) {
                    data.stats = { played: 0, wins: 0, losses: 0, bestLevel: 0 };
                }
                if (data.hasSeenHowToPlay === undefined) data.hasSeenHowToPlay = true;
                break;
        }
        
        // Update version
        data.version = this.currentVersion;
        this.save(data);
    },
    
    save(data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(CONFIG.STORAGE.KEY, serialized);
            return true;
        } catch (error) {
            console.error('Failed to save data:', error);
            
            // Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                this.handleQuotaExceeded();
            }
            
            return false;
        }
    },
    
    load() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE.KEY);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to load data:', error);
            this.clearCorruptedData();
            return null;
        }
    },
    
    clearCorruptedData() {
        console.warn('Clearing corrupted save data');
        localStorage.removeItem(CONFIG.STORAGE.KEY);
    },
    
    handleQuotaExceeded() {
        // Implement quota exceeded handling
        console.warn('Storage quota exceeded');
        // Could implement cleanup or warn user
    }
};

// ===== ANIMATION MANAGER =====
const AnimationManager = {
    useHardwareAcceleration: true,
    
    animateTile(tile, fromRect, toRect, duration = CONFIG.ANIMATION.TILE_FLY) {
        return new Promise(resolve => {
            // Use transform for better performance
            tile.style.willChange = 'transform';
            
            // Calculate transform values
            const deltaX = toRect.left - fromRect.left;
            const deltaY = toRect.top - fromRect.top;
            const deltaScale = toRect.width / fromRect.width;
            
            // Apply initial transform
            tile.style.transform = `translate(0, 0) scale(1)`;
            
            // Force reflow
            void tile.offsetWidth;
            
            // Apply animation
            tile.style.transition = `transform ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
            tile.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaScale})`;
            
            // Clean up after animation
            setTimeout(() => {
                tile.style.transition = '';
                tile.style.willChange = '';
                tile.style.transform = '';
                resolve();
            }, duration);
        });
    },
    
    animateModal(modal, show = true) {
        return new Promise(resolve => {
            modal.style.transition = `transform ${CONFIG.ANIMATION.MODAL_POP}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
            
            if (show) {
                modal.style.transform = 'scale(0.9)';
                modal.style.opacity = '0';
                modal.style.display = 'flex';
                
                void modal.offsetWidth;
                
                modal.style.transform = 'scale(1)';
                modal.style.opacity = '1';
            } else {
                modal.style.transform = 'scale(0.9)';
                modal.style.opacity = '0';
                
                setTimeout(() => {
                    modal.style.display = 'none';
                }, CONFIG.ANIMATION.MODAL_POP);
            }
            
            setTimeout(resolve, CONFIG.ANIMATION.MODAL_POP);
        });
    }
};

// ===== ACCESSIBILITY MANAGER =====
const AccessibilityManager = {
    init() {
        this.setupKeyboardNavigation();
        this.addAriaLabels();
        this.setupFocusManagement();
    },
    
    setupKeyboardNavigation() {
        // Make all interactive elements keyboard accessible
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const target = e.target;
                if (target.classList.contains('tile') && !target.classList.contains('in-dock')) {
                    e.preventDefault();
                    target.click();
                }
            }
        });
    },
    
    addAriaLabels() {
        // Add aria-labels to game elements
        const gameBoard = document.getElementById('gameBoard');
        if (gameBoard) {
            gameBoard.setAttribute('role', 'application');
            gameBoard.setAttribute('aria-label', 'Game board - match 3 tiles of the same type');
        }
        
        // Add labels to tiles dynamically when created
        this.updateTileLabels();
    },
    
    updateTileLabels() {
        document.querySelectorAll('.tile').forEach(tile => {
            const type = tile.dataset.type;
            const fruit = TileMasterApp.fruits.find(f => f.id === type);
            if (fruit && !tile.hasAttribute('aria-label')) {
                const labelBase = fruit.img
                    ? String(fruit.img).replace(/\.webp$/i, '')
                    : (fruit.id || 'game');
                tile.setAttribute('aria-label', `${labelBase} tile`);
                tile.setAttribute('role', 'button');
                tile.setAttribute('tabindex', '0');
            }
        });
    },
    
    setupFocusManagement() {
        // Manage focus for modals
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
            modal.addEventListener('show', () => {
                const focusableElements = modal.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                }
            });
        });
    },
    
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
};

// ====================================================================
// MAIN APPLICATION
// ====================================================================

const TileMasterApp = {
    // ===== STATE MANAGEMENT =====
    state: {
        dockTiles: [],
        isProcessing: false,
        layoutMap: [],
        currentLang: 'en',
        levelCounter: 1,
        selectedLayoutIndex: 0,
        tempSelectedLayoutIndex: 0,
        isRandomMode: false,
        levelRandomSeeds: {},
        userCoins: 100,
        magicCount: 5,
        undoCount: 5,
        activeMainThemeIdx: 0,
        activeGameThemeIdx: 0,
        tempMainThemeIdx: 0,
        tempGameThemeIdx: 0,
        pendingItemType: null,
        pendingItemPrice: 0,
        savedGameState: null,
        saveTimeout: null,
        stats: { played: 0, wins: 0, losses: 0, bestLevel: 0 },
        hasSeenHowToPlay: false
    },

    // ===== UI REFERENCES =====
    ui: {
        pages: {
            main: null,
            game: null,
            shop: null,
            coins: null,
            settings: null,
            appearance: null,
            language: null,
            levels: null
        }
    },

    // ===== TRANSLATIONS =====
    translations: { 
        en: { 
            gameName: 'Tile Master', playBtn: 'Play Now', level: 'Level ', shop: 'Shop', shopMsg: 'Shop', settings: 'Settings', sound: 'Sounds', lang: 'Language', langTitle: 'Language', theme: 'Themes', win: 'You Won!', lose: 'Game Over', replay: 'Continue', exit: 'Exit', confirmExit: 'Exit Game?', yes: 'Yes', no: 'No', menuTheme: 'Main Menu', gameTheme: 'Gameplay', cancel: 'Close', levelsTitle: 'Select Layout', random: 'Random', optional: 'Specific', levelGeneric: 'Level ', selectMsg: 'Choose layout you want to play with:', randomMsg: 'A random layout will be selected for every level', save: 'Save', saved: 'Saved Successfully', notSaved: 'Changes Discarded', item1Title: 'Wand x10', item1Desc: 'Auto matches tiles', item2Title: 'Undo x10', item2Desc: 'Undoes last move', buySuccess: 'Enjoy!', noCoins: 'Not enough free coins!', noItem: 'No boosts left! Get free coins on the coin screen or by winning.', buyCoinsTitle: 'Free coins', freeCoinsButton: 'Get coins', coinsAdded: 'Free coins added!', confirmBuyTitle: 'Confirm', confirmBuyMsg: 'Use free play coins for this? (No real money — the game is 100% free.)', howToPlayTitle: 'How to play', howToPlayText: 'Tap tiles to send them to the bottom bar. Three of the same type clear from the bar. Clear every tile before the bar is full. Use Undo or Magic when you need help. Win levels to earn coins, or tap Get coins — all coins are free. No in-app purchases; this game is totally free.', statsTitle: 'Your stats', statsPlayed: 'Games started', statsWins: 'Wins', statsLosses: 'Losses', statsBest: 'Best level', statsClose: 'Close', htpClose: 'Got it', howToPlayRow: 'How to play', statsRow: 'Statistics', coinsPageSubtitle: 'Totally free — no in-app purchases. Coins are free play points (earn them or get them here).', shopSubtitle: 'Uses free play coins only. No real money.', settingsFreeBanner: '100% free game — no in-app purchases.', pauseMenuTitle: 'Menu', resume: 'Resume', mainMenu: 'Main Menu', searchLang: 'Search language...'
        },
        ar: { 
            gameName: 'سيد البلاط', playBtn: 'العب الآن', level: 'المستوى ', shop: 'المتجر', shopMsg: 'المتجر', settings: 'الإعدادات', sound: 'الأصوات', lang: 'تغيير اللغة', langTitle: 'اللغة', theme: 'المظاهر', win: 'فزت!', lose: 'خسرت!', replay: 'متابعة', exit: 'خروج', confirmExit: 'هل تود الخروج؟', yes: 'نعم', no: 'لا', menuTheme: 'القائمة الرئيسية', gameTheme: 'صفحة اللعب', cancel: 'إغلاق', levelsTitle: 'الأشكال', random: 'عشوائي', optional: 'اختياري', levelGeneric: 'المستوى ', selectMsg: 'اختر الشكل الذي تريد اللعب به:', randomMsg: 'سيتم اختيار شكل عشوائي في كل مستوى', save: 'حفظ', saved: 'تم الحفظ بنجاح', notSaved: 'لم يتم حفظ التغييرات', item1Title: 'عصا x10', item1Desc: 'تقوم بمطابقة تلقائية', item2Title: 'تراجع x10', item2Desc: 'التراجع عن آخر خطوة', buySuccess: 'تمت!', noCoins: 'لا توجد عملات مجانية كافية!', noItem: 'لا يوجد! احصل على عملات مجانية من الشاشة أو بالفوز.', buyCoinsTitle: 'عملات مجانية', freeCoinsButton: 'احصل على عملات', coinsAdded: 'تمت إضافة عملات مجانية!', confirmBuyTitle: 'تأكيد', confirmBuyMsg: 'استخدام عملات اللعب المجانية لهذا؟ (لا مال حقيقي — اللعبة مجانية بالكامل.)', howToPlayTitle: 'كيفية اللعب', howToPlayText: 'اضغط البلاط لإرساله إلى الشريط السفلي. ثلاثة من النوع نفسه يزيلون من الشريط. أزل كل البلاط قبل امتلاء الشريط. استخدم التراجع أو السحر. العملات مجانية — اربحها أو أضفها هنا. لا مشتريات داخل التطبيق؛ اللعبة مجانية تماماً.', statsTitle: 'إحصائياتك', statsPlayed: 'ألعاب بدأت', statsWins: 'انتصارات', statsLosses: 'هزائم', statsBest: 'أفضل مستوى', statsClose: 'إغلاق', htpClose: 'حسناً', howToPlayRow: 'كيفية اللعب', statsRow: 'الإحصائيات', coinsPageSubtitle: 'مجانية بالكامل — لا مشتريات داخل التطبيق. العملات نقاط لعب مجانية.', shopSubtitle: 'عملات لعب مجانية فقط. لا مال حقيقي.', settingsFreeBanner: 'لعبة مجانية 100٪ — لا مشتريات داخل التطبيق.', pauseMenuTitle: 'القائمة', resume: 'استمرار', mainMenu: 'الرئيسية', searchLang: 'ابحث عن لغة...'
        }, 
        fr: {
            gameName: 'Maître Tuiles', playBtn: 'Jouer', level: 'Niveau ', shop: 'Boutique', shopMsg: 'Boutique', settings: 'Paramètres', sound: 'Sons', lang: 'Langue', langTitle: 'Langue', theme: 'Thèmes', win: 'Gagné !', lose: 'Perdu', replay: 'Continuer', exit: 'Quitter', confirmExit: 'Quitter le jeu ?', yes: 'Oui', no: 'Non', menuTheme: 'Menu Principal', gameTheme: 'Jeu', cancel: 'Fermer', levelsTitle: 'Dispositions', random: 'Aléatoire', optional: 'Spécifique', levelGeneric: 'Niveau ', selectMsg: 'Choisissez la disposition :', randomMsg: 'Une disposition aléatoire sera choisie', save: 'Sauver', saved: 'Sauvegardé', notSaved: 'Changements annulés', item1Title: 'Baguette x10', item1Desc: 'Match auto', item2Title: 'Annuler x10', item2Desc: 'Annuler coup', buySuccess: 'Profitez !', noCoins: 'Pas assez de pièces gratuites !', noItem: 'Plus d\'objets ! Pièces gratuites à l\'écran ou en gagnant.', buyCoinsTitle: 'Pièces gratuites', freeCoinsButton: 'Obtenir', coinsAdded: 'Pièces gratuites ajoutées !', confirmBuyTitle: 'Confirmer', confirmBuyMsg: 'Utiliser des pièces de jeu gratuites ? (Aucun argent réel — jeu 100 % gratuit.)', howToPlayTitle: 'Comment jouer', howToPlayText: 'Touchez les tuiles pour les envoyer en bas. Trois identiques disparaissent. Videz le plateau avant que la barre soit pleine. Utilisez Annuler ou Magie. Pièces gratuites : gagnez des niveaux ou touchez Obtenir. Aucun achat intégré ; jeu totalement gratuit.', statsTitle: 'Statistiques', statsPlayed: 'Parties', statsWins: 'Victoires', statsLosses: 'Défaites', statsBest: 'Meilleur niveau', statsClose: 'Fermer', htpClose: 'OK', howToPlayRow: 'Comment jouer', statsRow: 'Statistiques', coinsPageSubtitle: 'Totalement gratuit — pas d\'achats intégrés. Les pièces sont gratuites.', shopSubtitle: 'Pièces de jeu gratuites uniquement. Pas d\'argent réel.', settingsFreeBanner: 'Jeu 100 % gratuit — aucun achat intégré.', pauseMenuTitle: 'Menu', resume: 'Reprendre', mainMenu: 'Menu Principal', searchLang: 'Chercher langue...'
        },
        de: {
            gameName: 'Fliesenmeister', playBtn: 'Spielen', level: 'Level ', shop: 'Laden', shopMsg: 'Laden', settings: 'Einstel.', sound: 'Töne', lang: 'Sprache', langTitle: 'Sprache', theme: 'Themen', win: 'Gewonnen!', lose: 'Verloren', replay: 'Weiter', exit: 'Beenden', confirmExit: 'Spiel beenden?', yes: 'Ja', no: 'Nein', menuTheme: 'Hauptmenü', gameTheme: 'Spiel', cancel: 'Schließen', levelsTitle: 'Layouts', random: 'Zufällig', optional: 'Spezifisch', levelGeneric: 'Level ', selectMsg: 'Wähle das Layout:', randomMsg: 'Zufälliges Layout pro Level', save: 'Speichern', saved: 'Gespeichert', notSaved: 'Verworfen', item1Title: 'Stab x10', item1Desc: 'Auto-Match', item2Title: 'Zurück x10', item2Desc: 'Zug rückgängig', buySuccess: 'Viel Spaß!', noCoins: 'Nicht genug Gratis-Münzen!', noItem: 'Leer! Gratis-Münzen holen oder Level gewinnen.', buyCoinsTitle: 'Gratis-Münzen', freeCoinsButton: 'Holen', coinsAdded: 'Gratis-Münzen dazu!', confirmBuyTitle: 'Bestätigen', confirmBuyMsg: 'Gratis-Spielmünzen nutzen? (Kein echtes Geld — komplett kostenlos.)', howToPlayTitle: 'Spielanleitung', howToPlayText: 'Tippe auf Kacheln in die Leiste. Drei gleiche verschwinden. Räume das Feld rechtzeitig. Rückgängig oder Magie. Alle Münzen gratis — gewinnen oder holen. Keine In-App-Käufe; Spiel ist völlig kostenlos.', statsTitle: 'Statistik', statsPlayed: 'Spiele', statsWins: 'Siege', statsLosses: 'Niederlagen', statsBest: 'Bestes Level', statsClose: 'Schließen', htpClose: 'OK', howToPlayRow: 'Anleitung', statsRow: 'Statistik', coinsPageSubtitle: 'Völlig kostenlos — keine In-App-Käufe. Münzen sind gratis.', shopSubtitle: 'Nur Gratis-Spielmünzen. Kein echtes Geld.', settingsFreeBanner: '100 % kostenloses Spiel — keine In-App-Käufe.', pauseMenuTitle: 'Menü', resume: 'Fortsetzen', mainMenu: 'Hauptmenü', searchLang: 'Sprache suchen...'
        },
        es: {
            gameName: 'Maestro Azulejos', playBtn: 'Jugar', level: 'Nivel ', shop: 'Tienda', shopMsg: 'Tienda', settings: 'Ajustes', sound: 'Sonidos', lang: 'Idioma', langTitle: 'Idioma', theme: 'Temas', win: '¡Ganaste!', lose: 'Perdiste', replay: 'Seguir', exit: 'Salir', confirmExit: '¿Salir del juego?', yes: 'Sí', no: 'No', menuTheme: 'Menú Principal', gameTheme: 'Juego', cancel: 'Cerrar', levelsTitle: 'Diseños', random: 'Aleatorio', optional: 'Específico', levelGeneric: 'Nivel ', selectMsg: 'Elige el diseño:', randomMsg: 'Diseño aleatorio por nivel', save: 'Guardar', saved: 'Guardado', notSaved: 'Descartado', item1Title: 'Varita x10', item1Desc: 'Auto emparejar', item2Title: 'Deshacer x10', item2Desc: 'Deshacer mov.', buySuccess: '¡Disfruta!', noCoins: '¡Faltan monedas gratis!', noItem: '¡Sin ítems! Consigue monedas gratis en la pantalla o ganando.', buyCoinsTitle: 'Monedas gratis', freeCoinsButton: 'Obtener', coinsAdded: '¡Monedas gratis añadidas!', confirmBuyTitle: 'Confirmar', confirmBuyMsg: '¿Usar monedas de juego gratis? (Sin dinero real — 100 % gratis.)', howToPlayTitle: 'Cómo jugar', howToPlayText: 'Toca fichas hacia la barra. Tres iguales se van. Vacía el tablero a tiempo. Deshacer o Magia. Monedas gratis al ganar o en Obtener. Sin compras in-app; juego totalmente gratis.', statsTitle: 'Tus estadísticas', statsPlayed: 'Partidas', statsWins: 'Victorias', statsLosses: 'Derrotas', statsBest: 'Mejor nivel', statsClose: 'Cerrar', htpClose: 'OK', howToPlayRow: 'Cómo jugar', statsRow: 'Estadísticas', coinsPageSubtitle: 'Totalmente gratis — sin compras in-app. Las monedas son gratis.', shopSubtitle: 'Solo monedas de juego gratis. Sin dinero real.', settingsFreeBanner: 'Juego 100 % gratis — sin compras in-app.', pauseMenuTitle: 'Menú', resume: 'Reanudar', mainMenu: 'Menú Principal', searchLang: 'Buscar idioma...'
        },
        pt: {
            gameName: 'Mestre Azulejos', playBtn: 'Jogar', level: 'Nível ', shop: 'Loja', shopMsg: 'Loja', settings: 'Config.', sound: 'Sons', lang: 'Idioma', langTitle: 'Idioma', theme: 'Temas', win: 'Venceu!', lose: 'Perdeu', replay: 'Continuar', exit: 'Sair', confirmExit: 'Sair do jogo?', yes: 'Sim', no: 'Não', menuTheme: 'Menu Principal', gameTheme: 'Jogo', cancel: 'Fechar', levelsTitle: 'Layouts', random: 'Aleatório', optional: 'Específico', levelGeneric: 'Nível ', selectMsg: 'Escolha o layout:', randomMsg: 'Layout aleatório por nível', save: 'Salvar', saved: 'Salvo', notSaved: 'Descartado', item1Title: 'Varinha x10', item1Desc: 'Auto combinar', item2Title: 'Desfazer x10', item2Desc: 'Desfazer mov.', buySuccess: 'Aproveite!', noCoins: 'Moedas grátis insuficientes!', noItem: 'Sem itens! Pegue moedas grátis na tela ou ganhando.', buyCoinsTitle: 'Moedas grátis', freeCoinsButton: 'Obter', coinsAdded: 'Moedas grátis adicionadas!', confirmBuyTitle: 'Confirmar', confirmBuyMsg: 'Usar moedas de jogo grátis? (Sem dinheiro real — 100% grátis.)', howToPlayTitle: 'Como jogar', howToPlayText: 'Toque nas peças para a barra. Três iguais somem. Limpe antes de encher. Desfazer ou Magia. Moedas grátis ao vencer ou em Obter. Sem compras no app; jogo totalmente grátis.', statsTitle: 'Estatísticas', statsPlayed: 'Partidas', statsWins: 'Vitórias', statsLosses: 'Derrotas', statsBest: 'Melhor nível', statsClose: 'Fechar', htpClose: 'OK', howToPlayRow: 'Como jogar', statsRow: 'Estatísticas', coinsPageSubtitle: 'Totalmente grátis — sem compras no app. Moedas são grátis.', shopSubtitle: 'Só moedas de jogo grátis. Sem dinheiro real.', settingsFreeBanner: 'Jogo 100% grátis — sem compras no app.', pauseMenuTitle: 'Menu', resume: 'Retomar', mainMenu: 'Menu Principal', searchLang: 'Buscar idioma...'
        },
        ja: {
            gameName: 'タイルマスター', playBtn: 'プレイ', level: 'レベル ', shop: 'ショップ', shopMsg: 'ショップ', settings: '設定', sound: '音', lang: '言語', langTitle: '言語', theme: 'テーマ', win: '勝ち！', lose: '負け', replay: '次へ', exit: '終了', confirmExit: '終了しますか？', yes: 'はい', no: 'いいえ', menuTheme: 'メインメニュー', gameTheme: 'ゲーム画面', cancel: '閉じる', levelsTitle: '配置', random: 'ランダム', optional: '選択', levelGeneric: 'レベル ', selectMsg: '配置を選択してください:', randomMsg: '各レベルでランダムに配置', save: '保存', saved: '保存しました', notSaved: '変更破棄', item1Title: '魔法の杖 x10', item1Desc: '自動マッチ', item2Title: '元に戻す x10', item2Desc: '一手戻る', buySuccess: 'どうぞ！', noCoins: '無料コインが足りません！', noItem: 'ありません！画面で無料コインかクリアで。', buyCoinsTitle: '無料コイン', freeCoinsButton: 'もらう', coinsAdded: '無料コインを追加しました！', confirmBuyTitle: '確認', confirmBuyMsg: '無料のプレイコインを使いますか？（課金なし・完全無料）', howToPlayTitle: '遊び方', howToPlayText: 'タイルをバーへ。同じ3つで消去。バーが満杯になる前にクリア。元に戻す・魔法。コインはすべて無料。アプリ内課金なし、完全無料ゲーム。', statsTitle: '統計', statsPlayed: 'プレイ回数', statsWins: '勝利', statsLosses: '敗北', statsBest: '最高レベル', statsClose: '閉じる', htpClose: 'OK', howToPlayRow: '遊び方', statsRow: '統計', coinsPageSubtitle: '完全無料・アプリ内課金なし。コインは無料のプレイ用です。', shopSubtitle: '無料プレイコインのみ。実際のお金は使いません。', settingsFreeBanner: '100%無料 — アプリ内課金なし。', pauseMenuTitle: 'メニュー', resume: '再開', mainMenu: 'メインメニュー', searchLang: '言語を検索...'
        },
        ko: {
            gameName: '타일 마스터', playBtn: '플레이', level: '레벨 ', shop: '상점', shopMsg: '상점', settings: '설정', sound: '소리', lang: '언어', langTitle: '언어', theme: '테마', win: '승리!', lose: '패배', replay: '계속', exit: '종료', confirmExit: '종료하시겠습니까?', yes: '예', no: '아니요', menuTheme: '메인 메뉴', gameTheme: '게임 화면', cancel: '닫기', levelsTitle: '레이아웃', random: '랜덤', optional: '선택', levelGeneric: '레벨 ', selectMsg: '레이아웃을 선택하세요:', randomMsg: '레벨마다 랜덤 레이아웃', save: '저장', saved: '저장됨', notSaved: '변경 취소', item1Title: '마법봉 x10', item1Desc: '자동 매치', item2Title: '되돌리기 x10', item2Desc: '이전으로', buySuccess: '즐기세요!', noCoins: '무료 코인이 부족합니다!', noItem: '없음! 화면에서 무료 코인 또는 클리어로.', buyCoinsTitle: '무료 코인', freeCoinsButton: '받기', coinsAdded: '무료 코인이 추가되었습니다!', confirmBuyTitle: '확인', confirmBuyMsg: '무료 플레이 코인을 사용할까요? (실제 결제 없음 — 완전 무료.)', howToPlayTitle: '게임 방법', howToPlayText: '타일을 아래 바로 보냅니다. 같은 세 개가 사라집니다. 바가 차기 전에 치우세요. 되돌리기·마법. 코인은 모두 무료. 인앱 구매 없음, 완전 무료 게임.', statsTitle: '통계', statsPlayed: '게임 수', statsWins: '승리', statsLosses: '패배', statsBest: '최고 레벨', statsClose: '닫기', htpClose: '확인', howToPlayRow: '게임 방법', statsRow: '통계', coinsPageSubtitle: '완전 무료 — 인앱 구매 없음. 코인은 무료 플레이 포인트입니다.', shopSubtitle: '무료 플레이 코인만. 실제 돈 없음.', settingsFreeBanner: '100% 무료 게임 — 인앱 구매 없음.', pauseMenuTitle: '메뉴', resume: '재개', mainMenu: '메인 메뉴', searchLang: '언어 검색...'
        },
        zh: {
            gameName: '方块大师', playBtn: '开始游戏', level: '关卡 ', shop: '商店', shopMsg: '商店', settings: '设置', sound: '声音', lang: '语言', langTitle: '语言', theme: '主题', win: '胜利！', lose: '失败', replay: '继续', exit: '退出', confirmExit: '退出游戏？', yes: '是', no: '否', menuTheme: '主菜单', gameTheme: '游戏界面', cancel: '关闭', levelsTitle: '布局', random: '随机', optional: '自选', levelGeneric: '关卡 ', selectMsg: '选择你想玩的布局:', randomMsg: '每关随机选择布局', save: '保存', saved: '保存成功', notSaved: '更改已丢弃', item1Title: '魔杖 x10', item1Desc: '自动消除', item2Title: '撤销 x10', item2Desc: '撤销一步', buySuccess: '请用！', noCoins: '免费金币不足！', noItem: '用完了！在金币页领取免费金币或通关获得。', buyCoinsTitle: '免费金币', freeCoinsButton: '领取', coinsAdded: '已添加免费金币！', confirmBuyTitle: '确认', confirmBuyMsg: '使用免费游玩金币？（无真实付费，游戏完全免费。）', howToPlayTitle: '玩法说明', howToPlayText: '点击方块移入底栏，三个相同即消除，栏满前清空棋盘。可用撤销与魔法。金币均为免费；无应用内购买，游戏完全免费。', statsTitle: '统计', statsPlayed: '开局次数', statsWins: '胜利', statsLosses: '失败', statsBest: '最高关卡', statsClose: '关闭', htpClose: '好的', howToPlayRow: '玩法说明', statsRow: '统计', coinsPageSubtitle: '完全免费，无应用内购买。金币为免费游玩点数。', shopSubtitle: '仅使用免费游玩金币，无真实货币。', settingsFreeBanner: '100% 免费游戏，无应用内购买。', pauseMenuTitle: '菜单', resume: '继续', mainMenu: '主菜单', searchLang: '搜索语言...'
        }
    },

    // ===== THEMES =====
    // Updated Paths
    themes: { 
        main: [
            {bg:"url('assets/photo/1.webp') center/cover no-repeat"}, 
            {bg:"url('assets/photo/2.webp') center/cover no-repeat"}, 
            {bg:"url('assets/photo/3.webp') center/cover no-repeat"}, 
            {bg:"url('assets/photo/4.webp') center/cover no-repeat"}
        ], 
        game: [
            {bg:"url('assets/photo/5.webp') center/cover no-repeat"}, 
            {bg:"url('assets/photo/6.webp') center/cover no-repeat"}, 
            {bg:"url('assets/photo/7.webp') center/cover no-repeat"}, 
            {bg:"url('assets/photo/8.webp') center/cover no-repeat"}
        ] 
    },

    // ===== GAME ASSETS =====
    fruits: [
        {img:'tile1.webp', id:'a'},
        {img:'tile2.webp', id:'b'},
        {img:'tile3.webp', id:'c'},
        {img:'tile4.webp', id:'d'},
        {img:'tile5.webp', id:'e'},
        {img:'tile6.webp', id:'f'},
        {img:'tile7.webp', id:'g'},
        {img:'tile8.webp', id:'h'}
    ],

    // ===== UI HELPER METHODS =====
    showPage(key) { 
        Object.values(this.ui.pages).forEach(p => p.classList.add('hidden')); 
        this.ui.pages[key].classList.remove('hidden'); 
    },

    showToast(msg, type = 'success') { 
        const t = document.getElementById('toastNotification'); 
        const txt = document.getElementById('toastText'); 
        const icon = t.querySelector('i'); 
        txt.innerText = msg; 
        t.className = 'toast-notification show'; 
        
        if(type === 'warning') { 
            t.classList.add('warning'); 
            icon.className = 'fas fa-exclamation-circle'; 
        } else { 
            icon.className = 'fas fa-check-circle'; 
        } 
        
        setTimeout(() => { 
            t.classList.remove('show'); 
            setTimeout(() => t.classList.remove('warning'), 500); 
        }, CONFIG.ANIMATION.TOAST_SHOW); 
    },

    updateCoinUI() { 
        document.getElementById('coinCountMain').innerText = this.state.userCoins; 
        document.getElementById('coinCountGame').innerText = this.state.userCoins; 
    },

    refreshStatsDisplay() {
        const s = this.state.stats;
        const el = id => document.getElementById(id);
        el('statsPlayedVal').innerText = s.played;
        el('statsWinsVal').innerText = s.wins;
        el('statsLossesVal').innerText = s.losses;
        el('statsBestVal').innerText = s.bestLevel;
    },

    updatePowerUpUI() { 
        document.getElementById('magicBadge').innerText = this.state.magicCount; 
        document.getElementById('undoBadge').innerText = this.state.undoCount; 
    },

    // ===== GAME STATE MANAGEMENT =====
    requestSave() {
        clearTimeout(this.state.saveTimeout);
        this.state.saveTimeout = setTimeout(() => this.saveGameData(), CONFIG.ANIMATION.SAVE_THROTTLE);
    },

    saveGameData() {
        const state = this.state;
        let gameState = null;
        
        if(!this.ui.pages.game.classList.contains('hidden') && 
           (state.dockTiles.length > 0 || document.querySelectorAll('#gameBoard .tile').length > 0)) {
            
            const boardTiles = [];
            document.querySelectorAll('#gameBoard .tile:not(.in-dock):not(.removed)').forEach(t => {
                boardTiles.push({
                    type: t.dataset.type,
                    x: t.dataset.x,
                    y: t.dataset.y,
                    z: t.dataset.z,
                    left: t.style.left,
                    top: t.style.top,
                    zIndex: t.style.zIndex,
                    orgLeft: t.dataset.orgLeft,
                    orgTop: t.dataset.orgTop,
                    orgZ: t.dataset.orgZ,
                    orgWidth: t.dataset.orgWidth,
                    orgHeight: t.dataset.orgHeight,
                    width: t.style.width,
                    height: t.style.height
                });
            });

            const dockTypes = state.dockTiles.map(t => t.dataset.type);
            gameState = { boardTiles, dockTypes };
        }

        const data = { 
            version: CONFIG.STORAGE.VERSION,
            coins: state.userCoins, 
            magic: state.magicCount, 
            undo: state.undoCount, 
            level: state.levelCounter, 
            layout: state.selectedLayoutIndex, 
            isRandom: state.isRandomMode, 
            seeds: state.levelRandomSeeds, 
            themeMain: state.activeMainThemeIdx, 
            themeGame: state.activeGameThemeIdx, 
            lang: state.currentLang,
            savedGame: gameState,
            stats: { ...state.stats },
            hasSeenHowToPlay: state.hasSeenHowToPlay
        };
        
        StorageManager.save(data);
    },

    loadGameData() {
        const saved = StorageManager.load();
        const state = this.state;
        
        if (saved) {
            state.userCoins = saved.coins !== undefined ? saved.coins : 100;
            state.magicCount = saved.magic !== undefined ? saved.magic : 5;
            state.undoCount = saved.undo !== undefined ? saved.undo : 5;
            state.levelCounter = saved.level || 1;
            state.selectedLayoutIndex = saved.layout || 0;
            state.isRandomMode = saved.isRandom !== undefined ? saved.isRandom : false;
            state.levelRandomSeeds = saved.seeds || {};
            state.activeMainThemeIdx = saved.themeMain || 0;
            state.activeGameThemeIdx = saved.themeGame || 0;
            
            if(saved.lang) { 
                state.currentLang = saved.lang; 
            } else {
                state.currentLang = 'en';
            }
            
            document.documentElement.lang = state.currentLang;
            document.documentElement.dir = state.currentLang === 'ar' ? 'rtl' : 'ltr'; 

            if (saved.stats && typeof saved.stats === 'object') {
                state.stats = {
                    played: Number(saved.stats.played) || 0,
                    wins: Number(saved.stats.wins) || 0,
                    losses: Number(saved.stats.losses) || 0,
                    bestLevel: Number(saved.stats.bestLevel) || 0
                };
            }
            if (saved.hasSeenHowToPlay !== undefined) {
                state.hasSeenHowToPlay = !!saved.hasSeenHowToPlay;
            }

            return saved.savedGame;
        } else { 
            state.userCoins = 100; 
            state.magicCount = 5; 
            state.undoCount = 5; 
            state.isRandomMode = true;
            state.currentLang = 'en';
            state.stats = { played: 0, wins: 0, losses: 0, bestLevel: 0 };
            state.hasSeenHowToPlay = false;
            document.documentElement.lang = 'en';
            document.documentElement.dir = 'ltr';
            this.saveGameData(); 
        }
        
        this.updateCoinUI(); 
        this.updatePowerUpUI(); 
        state.tempMainThemeIdx = state.activeMainThemeIdx; 
        state.tempGameThemeIdx = state.activeGameThemeIdx;
        return null;
    },

    // ===== LAYOUT GENERATION =====
    getLayout(index) {
        let map = [];
        
        if(index === 0) { 
            map.push(
                {x:0,y:0,z:0},{x:1,y:0,z:0},{x:0,y:1,z:0},{x:1,y:1,z:0},{x:0,y:2,z:0},{x:1,y:2,z:0},{x:0,y:3,z:0},{x:1,y:3,z:0},{x:0,y:4,z:0},{x:1,y:4,z:0},
                {x:4,y:0,z:0},{x:5,y:0,z:0},{x:4,y:1,z:0},{x:5,y:1,z:0},{x:4,y:2,z:0},{x:5,y:2,z:0},{x:4,y:3,z:0},{x:5,y:3,z:0},{x:4,y:4,z:0},{x:5,y:4,z:0},
                {x:2,y:2,z:0},{x:3,y:2,z:0},
                {x:0.5,y:0.5,z:1},{x:0.5,y:1.5,z:1},{x:0.5,y:2.5,z:1},{x:0.5,y:3.5,z:1},
                {x:4.5,y:0.5,z:1},{x:4.5,y:1.5,z:1},{x:4.5,y:2.5,z:1},{x:4.5,y:3.5,z:1},
                {x:1.5,y:1.5,z:1},{x:3.5,y:1.5,z:1},{x:1.5,y:2.5,z:1},{x:3.5,y:2.5,z:1},
                {x:1,y:1.5,z:2},{x:1,y:2.5,z:2},{x:4,y:1.5,z:2},{x:4,y:2.5,z:2},
                {x:2,y:1.5,z:2},{x:3,y:1.5,z:2},{x:2,y:2.5,z:2},{x:3,y:2.5,z:2}
            ); 
        }
        else if (index === 1) { 
            for(let x=0; x<5; x++) 
                for(let y=0; y<5; y++) 
                    map.push({x:x, y:y, z:0}); 
                    
            for(let x=0; x<4; x++) 
                for(let y=0; y<4; y++) 
                    map.push({x:x+0.5, y:y+0.5, z:1}); 
                    
            map.push({x:2, y:2, z:2}); 
        }
        else if (index === 2) { 
            for (let x = 0; x < 5; x++) 
                for (let y = 0; y < 5; y++) 
                    map.push({ x: x, y: y, z: 0 }); 
                    
            for (let x = 0; x < 4; x++) 
                for (let y = 0; y < 4; y++) { 
                    if ((x === 1 && y === 1) || (x === 2 && y === 2)) continue; 
                    map.push({ x: x + 0.5, y: y + 0.5, z: 1 }); 
                } 
                
            for (let x = 0; x < 3; x++) 
                for (let y = 0; y < 2; y++) 
                    map.push({ x: x + 1, y: y + 1.5, z: 2 }); 
        }
        else if (index === 3) { 
            for(let x=0; x<5; x++) 
                for(let y=0; y<5; y++) 
                    if(!((x===0 && y===0) || (x===0 && y===4) || (x===4 && y===0) || (x===4 && y===4))) 
                        map.push({x:x, y:y, z:0}); 
                        
            [1, 2, 3].forEach(x => map.push({x:x, y:0.5, z:1})); 
            [0.5, 1.5, 2.5, 3.5].forEach(x => {
                map.push({x:x, y:1.5, z:1}); 
                map.push({x:x, y:2.5, z:1});
            }); 
            [1, 2, 3].forEach(x => map.push({x:x, y:3.5, z:1})); 
            map.push({x:2, y:4.25, z:1}); 
            
            [{x:1.5, y:1}, {x:2.5, y:1}, {x:1.5, y:2}, {x:2.5, y:2}, {x:1.5, y:3}, {x:2.5, y:3}].forEach(p => 
                map.push({...p, z:2})
            ); 
        }
        else if (index === 4) { 
            [{x:0,y:0},{x:0,y:1},{x:0,y:3},{x:0,y:4},{x:4,y:0},{x:4,y:1},{x:4,y:3},{x:4,y:4},
            {x:1,y:1},{x:1,y:2},{x:1,y:3},{x:3,y:1},{x:3,y:2},{x:3,y:3},
            {x:2,y:0},{x:2,y:1},{x:2,y:2},{x:2,y:3},{x:2,y:4}].forEach(t => 
                map.push({...t, z:0})
            ); 
            
            [{x:0.5, y:0.5}, {x:3.5, y:0.5}, {x:0.5, y:3.5}, {x:3.5, y:3.5}, 
            {x:2, y:0.5}, {x:2, y:3.5}, {x:1.5, y:1.5}, {x:2.5, y:1.5}, 
            {x:1.5, y:2.5}, {x:2.5, y:2.5}].forEach(t => 
                map.push({...t, z:1})
            ); 
            
            [{x:2, y:1.5}, {x:2, y:2.5}, {x:1, y:2}, {x:3, y:2}].forEach(t => 
                map.push({...t, z:2})
            ); 
        }
        else if (index === 5) { 
            [{y:0, start:0, count:5}, {y:1, start:1, count:3}, {y:2, start:2, count:1}, 
            {y:3, start:1, count:3}, {y:4, start:0, count:5}].forEach(row => { 
                for(let i=0; i<row.count; i++) 
                    map.push({x: row.start + i, y: row.y, z:0}); 
            }); 
            
            [{y:0.5, start:0.5, count:4}, {y:1.5, start:1.5, count:2}, 
            {y:2.5, start:1.5, count:2}, {y:3.5, start:0.5, count:4}].forEach(row => { 
                for(let i=0; i<row.count; i++) 
                    map.push({x: row.start + i, y: row.y, z:1}); 
            }); 
            
            [0.5, 1.5, 2.5, 3.5].forEach(y => 
                map.push({x:2, y:y, z:2})
            ); 
        }
        else if (index === 6) { 
            map.push({x:2, y:4, z:0}); 
            for(let i=0; i<5; i++) 
                map.push({x:i, y:3, z:0}); 
                
            for(let i=0; i<4; i++) 
                map.push({x:i+0.5, y:2, z:0}); 
                
            for(let i=0; i<3; i++) 
                map.push({x:i+1, y:1, z:0}); 
                
            map.push({x:1.5, y:0, z:0}); 
            map.push({x:2.5, y:0, z:0}); 
            
            for(let i=0; i<3; i++) 
                map.push({x:i+1, y:3.5, z:1}); 
                
            for(let i=0; i<3; i++) 
                map.push({x:i+1, y:2.5, z:1}); 
                
            map.push({x:1.5, y:1.5, z:1}); 
            map.push({x:2.5, y:1.5, z:1}); 
            map.push({x:2, y:0.5, z:1}); 
            
            map.push({x:2, y:1.5, z:2}); 
            map.push({x:2, y:2.5, z:2}); 
            map.push({x:2, y:3.5, z:2}); 
        }
        else if (index === 7) { 
            [{x:0, y:0}, {x:0, y:1}, {x:0, y:2}, {x:0, y:3}, 
            {x:4, y:0}, {x:4, y:1}, {x:4, y:2}, {x:4, y:3}, 
            {x:1, y:2}, {x:1, y:3}, {x:3, y:2}, {x:3, y:3}, 
            {x:2, y:1}, {x:2, y:2}].forEach(p => 
                map.push({...p, z:0})
            ); 
            
            [{x:0.5, y:0.5}, {x:0.5, y:1.5}, {x:0.5, y:2.5}, 
            {x:3.5, y:0.5}, {x:3.5, y:1.5}, {x:3.5, y:2.5}, 
            {x:1.5, y:2.5}, {x:2.5, y:2.5}, {x:1.5, y:1.5}, {x:2.5, y:1.5}].forEach(p => 
                map.push({...p, z:1})
            ); 
            
            [{x:0, y:0.5}, {x:0, y:2.5}, {x:4, y:0.5}, {x:4, y:2.5}, 
            {x:2, y:1.5}, {x:2, y:2.5}].forEach(p => 
                map.push({...p, z:2})
            ); 
        }
        else if (index === 8) { 
            const l0 = [
                {x:1,y:0},{x:2,y:0},{x:3,y:0}, 
                {x:0,y:1},{x:1,y:1},{x:2,y:1},{x:3,y:1},{x:4,y:1}, 
                {x:1,y:2},{x:2,y:2},{x:3,y:2}, 
                {x:1,y:3},{x:3,y:3}
            ];
            l0.forEach(p => map.push({...p, z:0}));
            
            const l1 = [
                {x:1.5, y:0.5}, {x:2.5, y:0.5}, 
                {x:0.5, y:1.5}, {x:1.5, y:1.5}, {x:2.5, y:1.5}, {x:3.5, y:1.5}, 
                {x:1.5, y:2.5}, {x:2.5, y:2.5}
            ];
            l1.forEach(p => map.push({...p, z:1}));
            
            const l2 = [
                {x:2, y:1.5}, {x:2, y:0.5}, {x:2, y:2.5}
            ];
            l2.forEach(p => map.push({...p, z:2}));
        }
        else if (index === 9) { 
            const l0 = [
                {x:1,y:0}, {x:2,y:0}, {x:3,y:0}, 
                {x:0,y:1}, {x:1,y:1}, {x:2,y:1}, {x:3,y:1}, {x:4,y:1}, 
                {x:0,y:2}, {x:1,y:2}, {x:2,y:2}, {x:3,y:2}, {x:4,y:2}, 
                {x:1,y:3}, {x:2,y:3}, {x:3,y:3}
            ];
            l0.forEach(p => map.push({...p, z:0}));
            
            const l1 = [
                {x:1.5, y:0.5}, {x:2.5, y:0.5}, 
                {x:0.5, y:1.5}, {x:1.5, y:1.5}, {x:2.5, y:1.5}, {x:3.5, y:1.5}, 
                {x:1.5, y:2.5}, {x:2.5, y:2.5}
            ];
            l1.forEach(p => map.push({...p, z:1}));
            
            const l2 = [
                {x:2, y:0.5}, {x:2, y:1.5}, {x:2, y:2.5}
            ];
            l2.forEach(p => map.push({...p, z:2}));
        }
        
        return map;
    },

    // ===== GAME INITIALIZATION =====
    initGame() {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';
        this.state.dockTiles = [];
        this.updateDock();
        this.updatePowerUpUI();
        this.state.isProcessing = false;
        
        const t = this.translations[this.state.currentLang];
        document.getElementById('levelText').innerText = `${t.levelGeneric} ${this.state.levelCounter}`;

        if(this.state.savedGameState) {
            this.resumeSavedGame(this.state.savedGameState);
            this.state.savedGameState = null;
            return;
        }

        let layoutToLoad = 0;
        if (this.state.isRandomMode) {
            if (this.state.levelRandomSeeds[this.state.levelCounter] === undefined || 
                this.state.levelRandomSeeds[this.state.levelCounter] === null) {
                this.state.levelRandomSeeds[this.state.levelCounter] = 
                    Math.floor(Math.random() * CONFIG.LAYOUT.COUNT);
                this.saveGameData();
            }
            layoutToLoad = this.state.levelRandomSeeds[this.state.levelCounter];
        } else {
            layoutToLoad = this.state.selectedLayoutIndex;
        }

        this.state.layoutMap = this.getLayout(layoutToLoad);
        if(this.state.layoutMap.length % 3 !== 0) { 
            while(this.state.layoutMap.length % 3 !== 0) 
                this.state.layoutMap.pop(); 
        }

        let deck = [];
        for(let i=0; i<this.state.layoutMap.length/3; i++) {
            const item = this.fruits[i % this.fruits.length];
            deck.push({...item}, {...item}, {...item});
        }
        deck.sort(() => Math.random() - 0.5);
        
        let minX=99, maxX=-99, minY=99, maxY=-99;
        this.state.layoutMap.forEach(p => { 
            minX=Math.min(minX,p.x); 
            maxX=Math.max(maxX,p.x); 
            minY=Math.min(minY,p.y); 
            maxY=Math.max(maxY,p.y); 
        });

        const container = document.getElementById('mobile-frame');
        const boardEl = document.getElementById('gameBoard');
        const availableWidth = container.clientWidth - 40;
        const availableHeight = boardEl.clientHeight - 20;
        const cols = maxX - minX + 1;
        const rows = maxY - minY + 1;
        let possibleW_byWidth = (availableWidth - (cols - 1) * CONFIG.LAYOUT.GAP_X) / cols;
        let possibleW_byHeight = (availableHeight - (rows - 1) * CONFIG.LAYOUT.GAP_Y) / rows;
        let tileW = Math.min(possibleW_byWidth, possibleW_byHeight);
        tileW = Math.min(CONFIG.TILE_SIZE.MAX, Math.max(CONFIG.TILE_SIZE.MIN, tileW));
        const tileH = tileW;
        const stepX = tileW + CONFIG.LAYOUT.GAP_X;
        const stepY = tileH + CONFIG.LAYOUT.GAP_Y;
        const mapW = ((maxX - minX) * stepX) + tileW;
        const startX = (container.clientWidth - mapW) / 2 - (minX * stepX);
        const startY = - (minY * stepY); 

        this.state.layoutMap.forEach((pos, i) => {
            const data = deck[i];
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.style.width = tileW + 'px';
            tile.style.height = tileH + 'px';
            tile.innerHTML = `<img src="assets/images/${data.img}" class="tile-img">`;
            tile.dataset.type = data.id;
            tile.dataset.x = pos.x; 
            tile.dataset.y = pos.y; 
            tile.dataset.z = pos.z;
            tile.style.left = (pos.x * stepX + startX) + 'px';
            tile.style.top = (pos.y * stepY + startY) + 'px';
            tile.style.zIndex = pos.z * 10 + 1;
            tile.dataset.orgLeft = tile.style.left;
            tile.dataset.orgTop = tile.style.top;
            tile.dataset.orgZ = tile.style.zIndex;
            tile.dataset.orgWidth = tile.style.width;
            tile.dataset.orgHeight = tile.style.height;
            board.appendChild(tile);
        });
        
        // Update accessibility labels for new tiles
        AccessibilityManager.updateTileLabels();
        
        this.checkBlocked();
    },

    resumeSavedGame(state) {
        const board = document.getElementById('gameBoard');
        
        state.boardTiles.forEach(tData => {
            const fruitData = this.fruits.find(f => f.id === tData.type) || this.fruits[0];
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.style.left = tData.left;
            tile.style.top = tData.top;
            tile.style.zIndex = tData.zIndex;
            tile.style.width = tData.width;
            tile.style.height = tData.height;
            tile.dataset.type = tData.type;
            tile.dataset.x = tData.x; 
            tile.dataset.y = tData.y; 
            tile.dataset.z = tData.z;
            
            tile.dataset.orgLeft = tData.orgLeft;
            tile.dataset.orgTop = tData.orgTop;
            tile.dataset.orgZ = tData.orgZ;
            tile.dataset.orgWidth = tData.orgWidth;
            tile.dataset.orgHeight = tData.orgHeight;
            
            tile.innerHTML = `<img src="assets/images/${fruitData.img}" class="tile-img">`;
            board.appendChild(tile);
        });

        state.dockTypes.forEach(type => {
            const fruitData = this.fruits.find(f => f.id === type) || this.fruits[0];
            const tile = document.createElement('div');
            tile.className = 'tile in-dock';
            tile.style.width = CONFIG.TILE_SIZE.DOCK + 'px';
            tile.style.height = CONFIG.TILE_SIZE.DOCK + 'px';
            tile.dataset.type = type;
            tile.innerHTML = `<img src="assets/images/${fruitData.img}" class="tile-img">`;
            board.appendChild(tile);
            this.state.dockTiles.push(tile);
        });

        this.updateDock();
        this.checkBlocked();
    },

    // ===== TILE INTERACTION =====
    checkBlocked() {
        const tiles = Array.from(document.querySelectorAll('.tile:not(.in-dock):not(.removed)'));
        tiles.forEach(currentTile => {
            const myX = parseFloat(currentTile.dataset.x);
            const myY = parseFloat(currentTile.dataset.y);
            const myZ = parseInt(currentTile.dataset.z);
            const isBlocked = tiles.some(upperTile => {
                const upperZ = parseInt(upperTile.dataset.z);
                if (upperTile === currentTile || upperZ <= myZ) return false;
                const dx = Math.abs(myX - parseFloat(upperTile.dataset.x));
                const dy = Math.abs(myY - parseFloat(upperTile.dataset.y));
                return dx < 0.85 && dy < 0.85;
            });
            if (isBlocked) currentTile.classList.add('blocked'); 
            else currentTile.classList.remove('blocked');
        });
    },

    async clickTile(tile) {
        if(this.state.isProcessing || 
           tile.classList.contains('blocked') || 
           tile.classList.contains('in-dock') || 
           this.state.dockTiles.length >= CONFIG.DOCK.MAX) 
            return;
            
        AudioManager.play('TILE_TAP');
        const startRect = tile.getBoundingClientRect();
        this.state.dockTiles.push(tile);
        tile.classList.add('in-dock'); 
        tile.classList.remove('blocked');
        
        const slots = document.querySelectorAll('.dock-slot');
        const targetIndex = this.state.dockTiles.length - 1;
        const targetSlot = slots[targetIndex].getBoundingClientRect();
        
        // Use AnimationManager for better performance
        await AnimationManager.animateTile(tile, startRect, targetSlot);
        
        // Update tile size after animation
        tile.style.width = CONFIG.TILE_SIZE.DOCK + 'px';
        tile.style.height = CONFIG.TILE_SIZE.DOCK + 'px';
        
        this.checkBlocked(); 
        this.requestSave(); 
        
        this.updateDock(); 
        this.checkMatch(); 
    },

    updateDock() {
        const slots = document.querySelectorAll('.dock-slot');
        this.state.dockTiles.forEach((t, i) => {
            if(t.classList.contains('flying')) return;
            const slot = slots[i].getBoundingClientRect();
            t.style.position = 'fixed'; 
            t.style.top = slot.top + 'px'; 
            t.style.left = slot.left + 'px'; 
            t.style.zIndex = 2000;
            t.style.width = CONFIG.TILE_SIZE.DOCK + 'px'; 
            t.style.height = CONFIG.TILE_SIZE.DOCK + 'px'; 
        });
        document.getElementById('dockWrapper').classList.toggle('danger', 
            this.state.dockTiles.length >= CONFIG.DOCK.WARNING_THRESHOLD);
    },

    checkMatch() {
        this.state.isProcessing = true;
        const counts = {}; 
        this.state.dockTiles.forEach(t => 
            counts[t.dataset.type] = (counts[t.dataset.type]||0)+1);
        
        const match = Object.keys(counts).find(k => counts[k] >= 3);
        
        if(match) {
            let removed = 0;
            this.state.dockTiles = this.state.dockTiles.filter(t => { 
                if(t.dataset.type === match && removed < 3) { 
                    t.classList.remove('in-dock'); 
                    t.classList.add('removed'); 
                    t.style.position = 'fixed';
                    setTimeout(() => t.remove(), CONFIG.ANIMATION.TILE_FLY); 
                    removed++; 
                    return false; 
                } 
                return true; 
            });
            
            setTimeout(() => { 
                this.updateDock(); 
                this.checkWin(); 
                this.requestSave();
                this.state.isProcessing = false; 
            }, CONFIG.ANIMATION.TILE_FLY);
        } else {
            if(this.state.dockTiles.length >= CONFIG.DOCK.MAX) { 
                this.showResultModal(false);
            }
            this.state.isProcessing = false;
        }
    },

    checkWin() {
        if(document.querySelectorAll('.tile:not(.removed):not(.in-dock)').length === 0 && 
           this.state.dockTiles.length === 0) {
            this.state.userCoins += 10; 
            this.updateCoinUI(); 
            this.state.stats.wins++;
            this.state.stats.bestLevel = Math.max(
                this.state.stats.bestLevel,
                this.state.levelCounter
            );
            this.saveGameData();
            this.showResultModal(true); 
        }
    },

    // ===== UI MODALS =====
    async showResultModal(isWin) {
        const modal = document.querySelector('.win-modal');
        const iconContainer = document.querySelector('.win-icon-container');
        const icon = iconContainer.querySelector('i');
        const title = document.getElementById('resultTitle');
        const restartBtn = document.getElementById('restartBtn');
        const container = document.getElementById('resultModal');

        if (isWin) {
            modal.classList.remove('is-loss');
            iconContainer.style.background = 'linear-gradient(45deg, #f1c40f, #f39c12)';
            icon.className = 'fas fa-crown';
            title.innerText = this.translations[this.state.currentLang].win; 
            title.style.color = '#2d3436';
            restartBtn.innerHTML = '<i class="fas fa-arrow-right"></i> ' + 
                this.translations[this.state.currentLang].replay; 
            AudioManager.play('WIN_LOSE');
        } else {
            this.state.stats.losses++;
            const data = StorageManager.load();
            if (data) {
                data.savedGame = null;
                data.stats = { ...this.state.stats };
                StorageManager.save(data);
            } else {
                this.saveGameData();
            }

            modal.classList.add('is-loss');
            iconContainer.style.background = 'linear-gradient(45deg, #ff7675, #d63031)';
            icon.className = 'fas fa-heart-broken'; 
            title.innerText = this.translations[this.state.currentLang].lose; 
            title.style.color = '#d63031';
            
            if(this.state.currentLang === 'ar') 
                restartBtn.innerHTML = '<i class="fas fa-redo"></i> إعادة';
            else 
                restartBtn.innerHTML = '<i class="fas fa-redo"></i> ' + 
                    (this.translations[this.state.currentLang].replay || 'Retry');
                
            AudioManager.play('WIN_LOSE');
        }

        await AnimationManager.animateModal(container, true);
    },

    // ===== LANGUAGE & TEXT FUNCTIONS =====
    selectLang(el) { 
        this.state.currentLang = el.dataset.lang; 
        document.documentElement.lang = this.state.currentLang;
        document.documentElement.dir = this.state.currentLang === 'ar' ? 'rtl' : 'ltr'; 
        document.querySelectorAll('#languagePage .fa-check').forEach(i=>i.style.display='none'); 
        el.querySelector('.fa-check').style.display='block'; 
        this.updateTexts(); 
        this.saveGameData();
    },

    updateTexts() {
        const t = this.translations[this.state.currentLang];
        
        const title = document.getElementById('mainTitle');
        if (title && title.tagName !== 'IMG') {
        title.innerText = t.gameName;
        } 
        document.getElementById('mainSubtitle').innerText = 
            `${t.levelGeneric} ${this.state.levelCounter}`; 
        document.getElementById('playBtnText').innerText = t.playBtn; 
        
        document.getElementById('levelText').innerText = 
            `${t.levelGeneric} ${this.state.levelCounter}`; 
        
        document.getElementById('shopTitle').innerText = t.shop; 
        document.getElementById('settingsTitle').innerText = t.settings; 
        document.getElementById('soundText').innerText = t.sound; 
        document.getElementById('langText').innerText = t.lang; 
        document.getElementById('langTitle').innerText = t.langTitle; 
        document.getElementById('themeTitle').innerText = t.theme; 
        document.getElementById('tabMenuBtn').innerText = t.menuTheme; 
        document.getElementById('tabGameBtn').innerText = t.gameTheme; 
        
        document.getElementById('restartBtn').innerText = t.replay; 
        document.getElementById('homeBtn').innerText = t.exit; 
        document.getElementById('exitTitle').innerText = t.confirmExit; 
        document.getElementById('confirmExitBtn').innerText = t.yes; 
        document.getElementById('cancelExitBtn').innerText = t.no; 
        
        document.getElementById('levelsTitle').innerText = t.levelsTitle; 
        document.getElementById('randomModeLabel').innerText = 
            this.state.isRandomMode ? t.random : t.optional; 
        document.getElementById('layoutSelectMsg').innerText = t.selectMsg; 
        document.getElementById('toastText').innerText = t.saved; 
        document.getElementById('coinsTitle').innerText = t.buyCoinsTitle;
        const coinSub = document.getElementById('coinsPageSubtitle');
        if (coinSub) coinSub.innerText = t.coinsPageSubtitle;
        const shopSub = document.getElementById('shopPageSubtitle');
        if (shopSub) shopSub.innerText = t.shopSubtitle;
        const freeBanner = document.getElementById('settingsFreeBanner');
        if (freeBanner) freeBanner.innerText = t.settingsFreeBanner;
        document.querySelectorAll('.coin-free-btn-label').forEach(el => {
            el.innerText = t.freeCoinsButton;
        });
        
        document.querySelector('.settings-btn-ext').setAttribute('title', t.settings); 
        document.querySelector('.shop-btn-ext').setAttribute('title', t.shop); 
        document.querySelector('.theme-btn-ext').setAttribute('title', t.theme); 
        document.querySelector('.levels-btn-ext').setAttribute('title', t.levelsTitle);
        document.querySelector('.website-btn-ext').addEventListener('click', () => {
            extendedMenu.classList.remove('show');
            window.open("https://sugar.tigaduadelapan.site/", "_blank");
        });
        
        document.getElementById('confirmBuyTitle').innerText = t.confirmBuyTitle;
        document.getElementById('btnConfirmBuy').innerText = t.yes;
        document.getElementById('btnCancelBuy').innerText = t.no;

        document.getElementById('pauseMenuTitle').innerText = t.pauseMenuTitle;
        document.getElementById('resumeGameBtn').innerText = t.resume;
        document.getElementById('quitToHomeBtn').innerText = t.mainMenu;
        document.getElementById('langSearch').placeholder = t.searchLang;

        document.getElementById('howToPlayTitleText').innerText = t.howToPlayTitle;
        document.getElementById('howToPlayBodyText').innerText = t.howToPlayText;
        document.getElementById('howToPlayCloseBtn').innerText = t.htpClose;
        document.getElementById('statsTitleText').innerText = t.statsTitle;
        document.getElementById('statsPlayedLabel').innerText = t.statsPlayed + ':';
        document.getElementById('statsWinsLabel').innerText = t.statsWins + ':';
        document.getElementById('statsLossesLabel').innerText = t.statsLosses + ':';
        document.getElementById('statsBestLabel').innerText = t.statsBest + ':';
        document.getElementById('statsCloseBtn').innerText = t.statsClose;
        document.getElementById('howToPlayRowText').innerText = t.howToPlayRow;
        document.getElementById('statsRowText').innerText = t.statsRow;
        this.refreshStatsDisplay();

        if(document.getElementById('item1Title')) { 
            document.getElementById('item1Title').innerText = t.item1Title; 
            document.getElementById('item1Desc').innerText = t.item1Desc; 
            document.getElementById('item2Title').innerText = t.item2Title; 
            document.getElementById('item2Desc').innerText = t.item2Desc; 
        }
        
        this.updatePowerUpUI();
    },

    // ===== LEVELS GRID RENDERING =====
    renderLevelsGrid() {
        const grid = document.getElementById('levelsGrid'); 
        grid.innerHTML = ''; 
        
        for(let i=0; i<CONFIG.LAYOUT.COUNT; i++) {
            const d = document.createElement('div'); 
            d.className = `level-card ${this.state.selectedLayoutIndex === i ? 'active' : ''}`;
            
            const miniBoardContainer = document.createElement('div'); 
            miniBoardContainer.className = 'mini-board-container';
            
            const map = this.getLayout(i);
            let minX = 99, maxX = -99, minY = 99, maxY = -99;
            
            map.forEach(p => { 
                minX = Math.min(minX, p.x); 
                maxX = Math.max(maxX, p.x); 
                minY = Math.min(minY, p.y); 
                maxY = Math.max(maxY, p.y); 
            });
            
            const mapWidth = (maxX - minX) * (CONFIG.TILE_SIZE.MINI + CONFIG.LAYOUT.MINI_GAP_X) + 
                CONFIG.TILE_SIZE.MINI;
            const mapHeight = (maxY - minY) * (CONFIG.TILE_SIZE.MINI + CONFIG.LAYOUT.MINI_GAP_Y) + 
                CONFIG.TILE_SIZE.MINI;
            
            miniBoardContainer.style.width = mapWidth + 'px'; 
            miniBoardContainer.style.height = mapHeight + 'px';
            
            const startX = - (minX * (CONFIG.TILE_SIZE.MINI + CONFIG.LAYOUT.MINI_GAP_X)); 
            const startY = - (minY * (CONFIG.TILE_SIZE.MINI + CONFIG.LAYOUT.MINI_GAP_Y));
            
            map.forEach(pos => { 
                const mt = document.createElement('div'); 
                mt.className = 'mini-tile'; 
                mt.style.width = CONFIG.TILE_SIZE.MINI + 'px'; 
                mt.style.height = CONFIG.TILE_SIZE.MINI + 'px'; 
                mt.style.left = (pos.x * (CONFIG.TILE_SIZE.MINI + CONFIG.LAYOUT.MINI_GAP_X) + startX) + 'px'; 
                mt.style.top = (pos.y * (CONFIG.TILE_SIZE.MINI + CONFIG.LAYOUT.MINI_GAP_Y) + startY) + 'px'; 
                mt.style.zIndex = pos.z; 
                
                if(pos.z === 0) mt.style.filter = "brightness(0.9)"; 
                if(pos.z === 2) mt.style.filter = "brightness(1.1)"; 
                
                miniBoardContainer.appendChild(mt); 
            });
            
            const largestDim = Math.max(mapWidth, mapHeight);
            
            if (largestDim > CONFIG.LAYOUT.MAX_CONTAINER_SIZE) { 
                const scale = CONFIG.LAYOUT.MAX_CONTAINER_SIZE / largestDim; 
                miniBoardContainer.style.transform = `scale(${scale})`; 
            }
            
            d.appendChild(miniBoardContainer);
            
            const checkMark = document.createElement('div'); 
            checkMark.className = 'check-mark'; 
            checkMark.innerHTML = '<i class="fas fa-check"></i>'; 
            d.appendChild(checkMark);
            
            d.onclick = () => { 
                this.state.tempSelectedLayoutIndex = i; 
                document.getElementById('randomCheck').checked = false; 
                document.getElementById('layoutsContainer').classList.remove('disabled-area'); 
                document.getElementById('randomModeLabel').innerText = 
                    this.translations[this.state.currentLang].optional; 
                document.getElementById('layoutSelectMsg').innerText = 
                    this.translations[this.state.currentLang].selectMsg; 
                document.querySelectorAll('.level-card').forEach(c => c.classList.remove('active')); 
                d.classList.add('active'); 
            }; 
            
            grid.appendChild(d);
        }
    },

    // ===== THEME RENDERING =====
    switchThemeTab(t) {
        document.querySelectorAll('.theme-tab').forEach(b => b.classList.remove('active')); 
        document.querySelectorAll('.theme-content-section').forEach(s => s.classList.remove('active'));
        
        if (t === 'main') { 
            document.getElementById('tabMenuBtn').classList.add('active'); 
            document.getElementById('mainThemeContainer').classList.add('active'); 
        } else { 
            document.getElementById('tabGameBtn').classList.add('active'); 
            document.getElementById('gameThemeContainer').classList.add('active'); 
        }
    },

    renderThemes() {
         const mainCont = document.getElementById('mainThemeContainer'); 
         const gameCont = document.getElementById('gameThemeContainer'); 
         mainCont.innerHTML = ''; 
         gameCont.innerHTML = '';
         
         const build = (arr, cont, isMain) => { 
             arr.forEach((th, i) => { 
                 const isActive = isMain ? 
                     (i === this.state.tempMainThemeIdx) : 
                     (i === this.state.tempGameThemeIdx); 
                 const d = document.createElement('div'); 
                 d.className = `theme-option ${isActive ? 'active' : ''}`; 
                 
                 const bgLayer = document.createElement('div');
                 bgLayer.className = 'theme-option-bg';
                 bgLayer.style.background = th.bg;
                 
                 if (!isMain) {
                     bgLayer.style.filter = "blur(3px)"; 
                     bgLayer.style.transform = "scale(1.1)"; 
                 }
                 
                 d.appendChild(bgLayer);
                 
                 const checkIcon = document.createElement('i');
                 checkIcon.className = "fas fa-check";
                 d.appendChild(checkIcon);
                 
                 d.onclick = () => { 
                     cont.querySelectorAll('.theme-option').forEach(x => x.classList.remove('active')); 
                     d.classList.add('active'); 
                     
                     if(isMain) { 
                         this.state.tempMainThemeIdx = i; 
                         document.getElementById('mobile-frame').style.background = 
                             this.themes.main[i].bg; 
                     } else { 
                         this.state.tempGameThemeIdx = i; 
                         document.getElementById('game-bg-layer').style.background = 
                             this.themes.game[i].bg; 
                     } 
                 }; 
                 
                 cont.appendChild(d); 
             }); 
         };
         
        build(this.themes.main, mainCont, true); 
        build(this.themes.game, gameCont, false);
        
        document.getElementById('mobile-frame').style.background = 
            this.themes.main[this.state.activeMainThemeIdx].bg; 
        document.getElementById('game-bg-layer').style.background = 
            this.themes.game[this.state.activeGameThemeIdx].bg;
    },

    // ===== SETUP METHODS =====
    setupNavigation() {
        const extendedMenu = document.getElementById('extendedMenu');
        
        document.getElementById('openSettingsPopOver').addEventListener('click', (e) => {
            e.stopPropagation();
            extendedMenu.classList.toggle('show');
        });
        
        document.addEventListener('click', (e) => { 
            if (extendedMenu.classList.contains('show') && 
                !extendedMenu.contains(e.target) && 
                !document.getElementById('openSettingsPopOver').contains(e.target)) { 
                extendedMenu.classList.remove('show'); 
            } 
        });
        
        document.querySelector('.start-btn').addEventListener('click', () => { 
            if (!this.state.savedGameState) {
                this.state.stats.played++;
                this.saveGameData();
            }
            this.showPage('game'); 
            this.initGame(); 
        });
        
        document.querySelector('.settings-btn-ext').addEventListener('click', () => { 
            extendedMenu.classList.remove('show'); 
            this.showPage('settings'); 
        });
        
        document.querySelector('.shop-btn-ext').addEventListener('click', () => { 
            extendedMenu.classList.remove('show'); 
            this.showPage('shop'); 
        });
        
        document.querySelector('.theme-btn-ext').addEventListener('click', () => { 
            extendedMenu.classList.remove('show'); 
            this.state.tempMainThemeIdx = this.state.activeMainThemeIdx; 
            this.state.tempGameThemeIdx = this.state.activeGameThemeIdx; 
            this.renderThemes(); 
            this.showPage('appearance'); 
        });
        
        document.querySelector('.levels-btn-ext').addEventListener('click', () => { 
            extendedMenu.classList.remove('show'); 
            this.state.tempSelectedLayoutIndex = this.state.selectedLayoutIndex; 
            document.getElementById('randomCheck').checked = this.state.isRandomMode; 
            
            const t = this.translations[this.state.currentLang]; 
            if(this.state.isRandomMode) { 
                document.getElementById('layoutsContainer').classList.add('disabled-area'); 
                document.getElementById('randomModeLabel').innerText = t.random; 
                document.getElementById('layoutSelectMsg').innerText = t.randomMsg; 
            } else { 
                document.getElementById('layoutsContainer').classList.remove('disabled-area'); 
                document.getElementById('randomModeLabel').innerText = t.optional; 
                document.getElementById('layoutSelectMsg').innerText = t.selectMsg; 
            } 
            
            this.renderLevelsGrid(); 
            this.showPage('levels'); 
        });
        
        document.querySelectorAll('.back-to-main').forEach(b => 
            b.addEventListener('click', () => this.showPage('main'))
        );
        
        document.getElementById('openLangPageBtn').addEventListener('click', () => 
            this.showPage('language')
        );
        
        document.getElementById('backToSettingsFromLang').addEventListener('click', () => 
            this.showPage('settings')
        );
        
        document.getElementById('saveLayoutsBtn').addEventListener('click', () => { 
            this.state.selectedLayoutIndex = this.state.tempSelectedLayoutIndex; 
            this.state.isRandomMode = document.getElementById('randomCheck').checked; 
            this.saveGameData(); 
            this.showToast(this.translations[this.state.currentLang].saved, 'success'); 
            this.showPage('main'); 
            this.updateTexts(); 
        });
        
        document.getElementById('saveThemeBtn').addEventListener('click', () => { 
            this.state.activeMainThemeIdx = this.state.tempMainThemeIdx; 
            this.state.activeGameThemeIdx = this.state.tempGameThemeIdx; 
            this.saveGameData(); 
            this.showToast(this.translations[this.state.currentLang].saved, 'success'); 
            this.showPage('main'); 
        });
        
        document.querySelectorAll('.buy-coins-btn').forEach(btn => { 
            btn.addEventListener('click', () => { 
                this.showPage('coins'); 
            }); 
        });
        
        document.getElementById('appearanceBackBtn').addEventListener('click', () => { 
            if(this.state.tempMainThemeIdx !== this.state.activeMainThemeIdx || 
               this.state.tempGameThemeIdx !== this.state.activeGameThemeIdx) { 
                document.getElementById('mobile-frame').style.background = 
                    this.themes.main[this.state.activeMainThemeIdx].bg; 
                document.getElementById('game-bg-layer').style.background = 
                    this.themes.game[this.state.activeGameThemeIdx].bg; 
                this.showToast(this.translations[this.state.currentLang].notSaved, 'warning'); 
            } 
            this.showPage('main'); 
        });
        
        document.getElementById('levelsBackBtn').addEventListener('click', () => { 
            const currentRandomState = document.getElementById('randomCheck').checked; 
            const isDirty = (currentRandomState !== this.state.isRandomMode) || 
                (this.state.tempSelectedLayoutIndex !== this.state.selectedLayoutIndex); 
            if (isDirty) { 
                this.showToast(this.translations[this.state.currentLang].notSaved, 'warning'); 
            } 
            this.showPage('main'); 
        });

        const howToPlayModal = document.getElementById('howToPlayModal');
        document.getElementById('openHowToPlayBtn').addEventListener('click', () => {
            const tm = this.translations[this.state.currentLang];
            document.getElementById('howToPlayTitleText').innerText = tm.howToPlayTitle;
            document.getElementById('howToPlayBodyText').innerText = tm.howToPlayText;
            document.getElementById('howToPlayCloseBtn').innerText = tm.htpClose;
            howToPlayModal.style.display = 'flex';
        });
        document.getElementById('howToPlayCloseBtn').addEventListener('click', () => {
            howToPlayModal.style.display = 'none';
            if (!this.state.hasSeenHowToPlay) {
                this.state.hasSeenHowToPlay = true;
                this.saveGameData();
            }
        });

        const statsModal = document.getElementById('statsModal');
        document.getElementById('openStatsBtn').addEventListener('click', () => {
            const tm = this.translations[this.state.currentLang];
            document.getElementById('statsTitleText').innerText = tm.statsTitle;
            document.getElementById('statsPlayedLabel').innerText = tm.statsPlayed + ':';
            document.getElementById('statsWinsLabel').innerText = tm.statsWins + ':';
            document.getElementById('statsLossesLabel').innerText = tm.statsLosses + ':';
            document.getElementById('statsBestLabel').innerText = tm.statsBest + ':';
            document.getElementById('statsCloseBtn').innerText = tm.statsClose;
            this.refreshStatsDisplay();
            statsModal.style.display = 'flex';
        });
        document.getElementById('statsCloseBtn').addEventListener('click', () => {
            statsModal.style.display = 'none';
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => { 
            if(document.getElementById('resultTitle').style.color !== 'rgb(214, 48, 49)') { 
                this.state.levelCounter++; 
                this.saveGameData(); 
                this.updateTexts(); 
            } 
            document.getElementById('resultModal').style.display = 'none'; 
            this.initGame(); 
        });
        
        document.getElementById('homeBtn').addEventListener('click', () => { 
            document.getElementById('resultModal').style.display = 'none'; 
            this.showPage('main'); 
        });
        
        const exitModal = document.getElementById('exitModal');
        document.getElementById('confirmExitBtn').addEventListener('click', () => { 
            exitModal.style.display = 'none'; 
            this.showPage('main'); 
        });
        
        document.getElementById('cancelExitBtn').addEventListener('click', () => 
            exitModal.style.display = 'none'
        );
        
        document.getElementById('randomCheck').addEventListener('change', () => { 
            const t = this.translations[this.state.currentLang]; 
            if(document.getElementById('randomCheck').checked) { 
                document.getElementById('layoutsContainer').classList.add('disabled-area'); 
                document.getElementById('randomModeLabel').innerText = t.random; 
                document.getElementById('layoutSelectMsg').innerText = t.randomMsg; 
            } else { 
                document.getElementById('layoutsContainer').classList.remove('disabled-area'); 
                document.getElementById('randomModeLabel').innerText = t.optional; 
                document.getElementById('layoutSelectMsg').innerText = t.selectMsg; 
            } 
        });
    },

    setupGameControls() {
        document.getElementById('undoBtn').addEventListener('click', () => {
            if(this.state.isProcessing || this.state.dockTiles.length === 0) return;
            if(this.state.undoCount <= 0) { 
                this.showToast(this.translations[this.state.currentLang].noItem, 'warning'); 
                return; 
            }

            const tile = this.state.dockTiles.pop();
            tile.classList.remove('in-dock');
            
            tile.style.position = 'absolute';
            tile.style.left = tile.dataset.orgLeft;
            tile.style.top = tile.dataset.orgTop;
            tile.style.width = tile.dataset.orgWidth;
            tile.style.height = tile.dataset.orgHeight;
            tile.style.zIndex = tile.dataset.orgZ;
            tile.style.transform = '';

            this.state.undoCount--;
            this.updatePowerUpUI();
            this.updateDock();
            this.checkBlocked();
            this.requestSave();
        });
        
        document.getElementById('magicBtn').addEventListener('click', async () => {
            if (this.state.isProcessing || this.state.dockTiles.length === 0) return;
            if (this.state.magicCount <= 0) { 
                this.showToast(this.translations[this.state.currentLang].noItem, 'warning'); 
                return; 
            }
            
            const targetTile = this.state.dockTiles[this.state.dockTiles.length - 1]; 
            const targetType = targetTile.dataset.type;
            const countInDock = this.state.dockTiles.filter(t => 
                t.dataset.type === targetType).length; 
            const needed = 3 - countInDock;
            
            if (needed <= 0) return;
            
            const boardTiles = Array.from(
                document.querySelectorAll('.tile:not(.in-dock):not(.removed)')); 
            const matchingTiles = boardTiles.filter(t => t.dataset.type === targetType);
            
            if (matchingTiles.length < needed) return;
            
            this.state.isProcessing = true;
            
            const slots = document.querySelectorAll('.dock-slot');
            const tilesToAnimate = [];
            for (let i = 0; i < needed; i++) {
                const tile = matchingTiles[i];
                this.state.dockTiles.push(tile); 
                tile.classList.add('in-dock'); 
                tile.classList.remove('blocked');
                tilesToAnimate.push(tile);
            }
            
            // Animate tiles sequentially
            for (let i = 0; i < tilesToAnimate.length; i++) {
                const tile = tilesToAnimate[i];
                const startRect = tile.getBoundingClientRect();
                const targetSlotIndex = Math.min(
                    this.state.dockTiles.length - needed + i, CONFIG.DOCK.MAX - 1); 
                const targetSlot = slots[targetSlotIndex].getBoundingClientRect();
                
                await AnimationManager.animateTile(tile, startRect, targetSlot);
                
                // Update tile size after animation
                tile.style.width = CONFIG.TILE_SIZE.DOCK + 'px';
                tile.style.height = CONFIG.TILE_SIZE.DOCK + 'px';
            }
            
            this.updateDock(); 
            this.checkBlocked(); 
            this.checkMatch(); 
            this.state.magicCount--; 
            this.updatePowerUpUI(); 
            this.requestSave();
            this.state.isProcessing = false;
        });
        
        const pauseModal = document.getElementById('pauseModal');
        const gameSettingsBtn = document.getElementById('gameSettingsBtn');
        const newGameSettingsBtn = gameSettingsBtn.cloneNode(true);
        gameSettingsBtn.parentNode.replaceChild(newGameSettingsBtn, gameSettingsBtn);
        
        newGameSettingsBtn.addEventListener('click', () => { 
            pauseModal.style.display = 'flex'; 
        });
        
        document.getElementById('resumeGameBtn').addEventListener('click', () => { 
            pauseModal.style.display = 'none'; 
        });
        
        document.getElementById('quitToHomeBtn').addEventListener('click', () => { 
            pauseModal.style.display = 'none'; 
            document.getElementById('exitModal').style.display = 'flex'; 
        });
    },

    setupShopFunctions() {
        document.querySelectorAll('.buy-btn-3d[data-price]').forEach(button => {
            button.addEventListener('click', () => {
                const price = parseInt(button.dataset.price);
                const type = button.dataset.type;
                
                if (this.state.userCoins < price) {
                    this.showToast(this.translations[this.state.currentLang].noCoins, 'warning');
                    return;
                }
                
                this.state.pendingItemType = type;
                this.state.pendingItemPrice = price;
                
                document.getElementById('confirmBuyMsg').innerText = 
                    this.translations[this.state.currentLang].confirmBuyMsg + 
                    (this.state.currentLang === 'ar' ? " ؟" : " ?");
                document.getElementById('shopConfirmModal').style.display = 'flex';
            });
        });
        
        document.querySelectorAll('.buy-btn-3d[data-coins]').forEach(button => {
            button.addEventListener('click', () => {
                const coins = parseInt(button.dataset.coins);
                this.addFreeCoins(coins);
            });
        });
        
        document.querySelectorAll('#langList .settings-row[data-lang]').forEach(row => {
            row.addEventListener('click', () => {
                this.selectLang(row);
            });
        });
        
        document.querySelectorAll('.theme-tab[data-tab]').forEach(button => {
            button.addEventListener('click', () => {
                this.switchThemeTab(button.dataset.tab);
            });
        });

        document.getElementById('btnConfirmBuy').addEventListener('click', () => {
            if (this.state.pendingItemType && this.state.userCoins >= this.state.pendingItemPrice) {
                this.state.userCoins -= this.state.pendingItemPrice;
                if (this.state.pendingItemType === 'magic') {
                    this.state.magicCount += 10;
                } else if (this.state.pendingItemType === 'undo') {
                    this.state.undoCount += 10;
                }
                this.updateCoinUI();
                this.updatePowerUpUI();
                this.saveGameData();
                this.showToast(this.translations[this.state.currentLang].buySuccess, 'success');
            }
            document.getElementById('shopConfirmModal').style.display = 'none';
            this.state.pendingItemType = null;
            this.state.pendingItemPrice = 0;
        });

        document.getElementById('btnCancelBuy').addEventListener('click', () => {
            document.getElementById('shopConfirmModal').style.display = 'none';
            this.state.pendingItemType = null;
            this.state.pendingItemPrice = 0;
        });
    },

    addFreeCoins(amount) { 
        this.state.userCoins += amount;
        this.updateCoinUI();
        this.saveGameData();
        this.showToast(this.translations[this.state.currentLang].coinsAdded, 'success');
    },

    // ===== INITIALIZATION =====
    async init() {
        // Initialize managers
        await AudioManager.init();
        StorageManager.init();
        AccessibilityManager.init();
        
        // Initialize UI references
        this.ui.pages.main = document.getElementById('mainPage');
        this.ui.pages.game = document.getElementById('gamePage');
        this.ui.pages.shop = document.getElementById('shopPage');
        this.ui.pages.coins = document.getElementById('coinsPage');
        this.ui.pages.settings = document.getElementById('settingsPage');
        this.ui.pages.appearance = document.getElementById('appearancePage');
        this.ui.pages.language = document.getElementById('languagePage');
        this.ui.pages.levels = document.getElementById('levelsPage');
        
        // Load saved game data
        this.state.savedGameState = this.loadGameData();
        
        // Setup all UI elements and event listeners
        this.setupNavigation();
        this.setupGameControls();
        this.setupShopFunctions();
        
        // pointerdown keeps playback in the same user gesture on Android WebView; delayed
        // `click` often loses gesture context and causes NotAllowedError on HTMLAudioElement.play().
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            const tile = e.target.closest('.tile:not(.in-dock):not(.removed)');
            if (tile) {
                e.preventDefault();
                this.clickTile(tile);
            }
        });
        
        // Initial rendering
        this.renderThemes();
        this.updateTexts();

        if (!this.state.hasSeenHowToPlay) {
            document.getElementById('howToPlayModal').style.display = 'flex';
        }
        
        // Save game before closing
        window.addEventListener('beforeunload', () => {
            this.saveGameData();
        });
        
        // UI sounds on pointerdown (same user gesture as touch — WebView often rejects play() on delayed click)
        document.addEventListener(
            'pointerdown',
            (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                if (
                    e.target.closest(
                        'button, .game-icon-btn, .menu-popover-btn, .settings-row, .level-card, .theme-option, .buy-btn-3d, .game-action-btn'
                    )
                ) {
                    AudioManager.play('BUTTON_CLICK');
                }
            },
            { passive: true }
        );
    }
};

// Start the game when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    TileMasterApp.init();
});