class QBinMDEditor extends QBinEditorBase {
    constructor() {
        super();
        this.currentEditor = "md";
        this.contentType = "text/markdown; charset=UTF-8";
        this.saveDebounceTimeout = null;
        this.uploadDebounceTimeout = null;
        this.passwordPanelInitialized = false;
        this.currentTheme = this.getThemePreference();
        this.initialize();
    }

    getThemePreference() {
        const savedTheme = localStorage.getItem('qbin-theme') || 'system';
        if (savedTheme === 'dark') return 'dark';
        if (savedTheme === 'light') return 'light';
        // System preference:
        return window.matchMedia('(prefers-color-scheme: dark)').matches ?
            'dark' : 'light';
    }

    toolbarsConfig(config){
        if(isMobile()){
            config.toolbar = [
                    'switchModel',
                    {
                        insert: ['image', 'audio', 'video', 'link', 'hr', 'br', 'code', 'inlineCode', 'toc', 'table', 'pdf', 'word', 'file'],
                    },
                    'search',
                ];
            config.toolbarRight = ['mySettings', 'togglePreview', 'undo', 'redo', ];
            config.sidebar = null;
            config.bubble = false;
        }else {
            config.toolbar = [
                    'switchModel',
                    'bold',
                    'italic',
                    {
                        strikethrough: ['strikethrough', 'underline', 'sub', 'sup'],
                    },
                    'size',
                    '|',
                    'color',
                    'header',
                    '|',
                    'ol',
                    'ul',
                    'checklist',
                    'panel',
                    'justify',
                    'detail',
                    '|',
                    {
                        insert: ['image', 'audio', 'video', 'link', 'hr', 'br', 'code', 'inlineCode', 'toc', 'table', 'pdf', 'word', 'file'],
                    },
                    'undo',
                    'redo',
                    'export',
                ];
            config.toolbarRight = ['mySettings', 'togglePreview', 'shortcutKey', 'wordCount'];
            config.bubble = ['bold', 'italic', 'underline', 'strikethrough', 'sub', 'sup', 'quote', '|', 'size', 'color'];
            config.sidebar = null;
        }
        return config
    }

    async initEditor() {
        const locale = (navigator.language || navigator.userLanguage).replace("-", "_");
        const customSettings = Cherry.createMenuHook('设置', {
          icon: {
            type: 'svg',
            content: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><defs><symbol id="lineMdCogLoop0"><path d="M15.24 6.37C15.65 6.6 16.04 6.88 16.38 7.2C16.6 7.4 16.8 7.61 16.99 7.83C17.46 8.4 17.85 9.05 18.11 9.77C18.2 10.03 18.28 10.31 18.35 10.59C18.45 11.04 18.5 11.52 18.5 12"><animate fill="freeze" attributeName="d" begin="0.45s" dur="0.1s" values="M15.24 6.37C15.65 6.6 16.04 6.88 16.38 7.2C16.6 7.4 16.8 7.61 16.99 7.83C17.46 8.4 17.85 9.05 18.11 9.77C18.2 10.03 18.28 10.31 18.35 10.59C18.45 11.04 18.5 11.52 18.5 12;M15.24 6.37C15.65 6.6 16.04 6.88 16.38 7.2C16.38 7.2 19 6.12 19.01 6.14C19.01 6.14 20.57 8.84 20.57 8.84C20.58 8.87 18.35 10.59 18.35 10.59C18.45 11.04 18.5 11.52 18.5 12"/></path></symbol></defs><g fill="none" stroke="currentColor" stroke-width="1.2"><g stroke-linecap="round"><path stroke-dasharray="20" stroke-dashoffset="20" d="M12 9c1.66 0 3 1.34 3 3c0 1.66 -1.34 3 -3 3c-1.66 0 -3 -1.34 -3 -3c0 -1.66 1.34 -3 3 -3Z"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.1s" values="20;0"/></path><path stroke-dasharray="48" stroke-dashoffset="48" d="M12 5.5c3.59 0 6.5 2.91 6.5 6.5c0 3.59 -2.91 6.5 -6.5 6.5c-3.59 0 -6.5 -2.91 -6.5 -6.5c0 -3.59 2.91 -6.5 6.5 -6.5Z"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.1s" dur="0.3s" values="48;0"/><set fill="freeze" attributeName="opacity" begin="0.45s" to="0"/></path></g><g opacity="0"><use href="#lineMdCogLoop0"/><use href="#lineMdCogLoop0" transform="rotate(60 12 12)"/><use href="#lineMdCogLoop0" transform="rotate(120 12 12)"/><use href="#lineMdCogLoop0" transform="rotate(180 12 12)"/><use href="#lineMdCogLoop0" transform="rotate(240 12 12)"/><use href="#lineMdCogLoop0" transform="rotate(300 12 12)"/><set fill="freeze" attributeName="opacity" begin="0.45s" to="1"/><animateTransform attributeName="transform" dur="15s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/></g></g></svg>',
            iconStyle: 'width: 18px; height: 18px; vertical-align: middle;',
          },
          onClick: () => {
            this.togglePasswordPanel(true); // 传入 true 表示是点击触发
          }
        });
        const toolbars = {
            showToolbar: true,
            toolbar: [],
            toolbarRight: [],
            bubble: [],
            sidebar: [],
            customMenu: {
                mySettings: customSettings,
            },
            toc: true,
            float: false,
        };

        // Initialize Mermaid 10.3.1 before Cherry
        this.initializeMermaid();

        // TODO 实现sidebar Zen模式
        const basicConfig = {
            id: 'markdown',
            nameSpace: 'qbin',
            externals: {
                echarts: window.echarts,
                katex: window.katex,
                MathJax: window.MathJax,
            },
            engine: {
                global: {
                    flowSessionContext: true,
                },
                syntax: {
                    codeBlock: {
                        theme: 'twilight',
                        lineNumber: true,
                        expandCode: true,
                        changeLang: false,
                        editCode: false,
                        wrap: false,
                    },
                    table: {
                        enableChart: true,
                    },
                    fontEmphasis: {
                        allowWhitespace: false,
                    },
                    strikethrough: {
                        needWhitespace: false,
                    },
                    mathBlock: {
                      engine: 'katex',
                    },
                    inlineMath: {
                      engine: 'katex',
                    },
                },
            },
            multipleFileSelection: {
                video: false,
                audio: false,
                image: false,
                word: false,
                pdf: false,
                file: false,
            },
            toolbars: this.toolbarsConfig(toolbars),
            previewer: {
                dom: false,
                enablePreviewerBubble: false,
                floatWhenClosePreviewer: false,
                lazyLoadImg: {
                    maxNumPerTime: 2,
                    noLoadImgNum: 5,
                    autoLoadImgNum: 5,
                    maxTryTimesPerSrc: 2,
                }
            },
            editor: {
                id: 'qbin-text',
                name: 'qbin-text',
                autoSave2Textarea: false,
                defaultModel: 'edit&preview',
                showFullWidthMark: false,
                showSuggestList: false,
                writingStyle: 'normal',
            },
            themeSettings: {
                mainTheme: this.currentTheme,
                codeBlockTheme: 'default',
            },
            callback: {
                // onPaste: (clipboardData) => console.log(clipboardData),
                afterChange: (text, html) => {
                    this.handleContentChange(text);
                },
            },
            event: {
                changeMainTheme: (theme) => {
                    const userPreference = localStorage.getItem('qbin-theme') || 'system';
                    if (userPreference === 'system') {
                        localStorage.setItem('qbin-theme', 'system');
                    }
                    document.documentElement.classList.remove('light-theme', 'dark-theme');
                    document.documentElement.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme');
                }
            },
            isPreviewOnly: false,
            autoScrollByHashAfterInit: true,
            locale: locale,
        };
        const config = Object.assign({}, basicConfig, { value: "" });
        Cherry.usePlugin(CherryCodeBlockMermaidPlugin, {
          mermaid: window.mermaid,
          theme: 'default',
          sequence: {
            useMaxWidth: false,
            showSequenceNumbers: true,
            mirrorActors: true,
            messageAlign: 'center'
          },
          flowchart: {
            htmlLabels: true,
            curve: 'linear'
          }
        });
        Cherry.usePlugin(CherryTableEchartsPlugin, {
          mermaid: window.echarts,
        });
        window.cherry = new Cherry(config);
        this.setupEditorChangeListener();
        this.initializePasswordPanel();
        this.setupThemeListener();
        return window.cherry;
    }

    // Add Mermaid initialization function
    initializeMermaid() {
        if (!window.mermaid) {
            console.error('Mermaid library not loaded');
            return;
        }

        // Create a mermaid rendering container
        const mermaidContainer = document.createElement('div');
        mermaidContainer.id = 'mermaid-container';
        mermaidContainer.style = 'width:1024px;height:0;visibility:hidden;position:absolute;pointer-events:none;';
        document.body.appendChild(mermaidContainer);

        // Configure Mermaid 10.x
        window.mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose', // Required for proper SVG manipulation
            fontFamily: 'sans-serif',
            altFontFamily: 'sans-serif',
            flowchart: {
                useMaxWidth: false,
                htmlLabels: true,
                curve: 'linear'
            },
            sequence: {
                useMaxWidth: false,
                showSequenceNumbers: true,
                mirrorActors: true,
                messageAlign: 'center'
            },
            logLevel: 5, // Set to error only
            silent: true, // Completely disable logs
            verbose: false
        });

        // Create a compatibility layer for the plugin
        this.createMermaidCompatibilityLayer();

        // Setup a global renderer that can be triggered on editor changes
        this.setupMermaidAutoRender();
    }

    setupMermaidAutoRender() {
        // Create a global mermaid renderer that will be triggered on editor changes
        if (!window.qbinMermaidRenderer) {
            window.qbinMermaidRenderer = {
                diagramCache: new Map(),
                pendingRenders: new Map(),
                renderQueue: [],

                // Process all diagrams that need rendering
                processQueue: function() {
                    if (this.renderQueue.length === 0) return;

                    // Process each diagram in the queue
                    this.renderQueue.forEach(item => {
                        const { id, placeholder } = item;

                        // If we have this diagram in cache, replace placeholder immediately
                        if (this.diagramCache.has(id)) {
                            this.replacePlaceholder(placeholder, this.diagramCache.get(id));
                            return;
                        }

                        // If this diagram is already being rendered, just add the placeholder
                        if (this.pendingRenders.has(id)) {
                            this.pendingRenders.get(id).push(placeholder);
                            return;
                        }

                        // Start a new render for this diagram
                        this.pendingRenders.set(id, [placeholder]);
                        this.renderDiagram(id);
                    });

                    // Clear the queue
                    this.renderQueue = [];
                },

                // Replace a placeholder with rendered content
                replacePlaceholder: function(placeholder, content) {
                    if (!placeholder || !placeholder.parentNode) return;

                    const container = document.createElement('div');
                    container.innerHTML = content;
                    placeholder.parentNode.replaceChild(container.firstChild, placeholder);
                },

                // Render a specific diagram by ID
                renderDiagram: function(id) {
                    try {
                        const mermaidEl = document.getElementById(id);
                        if (!mermaidEl) {
                            this.handleRenderComplete(id, `<div class="cherry-code-block-error">Mermaid error: Element not found</div>`);
                            return;
                        }

                        const code = mermaidEl.textContent;
                        window.mermaid.render(id, code).then(result => {
                            this.handleRenderComplete(id, result.svg);
                        }).catch(error => {
                            console.error('Mermaid rendering error:', error);
                            this.handleRenderComplete(id, `<div class="cherry-code-block-error">Mermaid error: ${error.message || 'Unknown error'}</div>`);
                        });
                    } catch (error) {
                        console.error('Error rendering mermaid diagram:', error);
                        this.handleRenderComplete(id, `<div class="cherry-code-block-error">Mermaid error: ${error.message || 'Unknown error'}</div>`);
                    }
                },

                // Handle completion of a diagram render
                handleRenderComplete: function(id, content) {
                    // Store in cache
                    this.diagramCache.set(id, content);

                    // Update all placeholders for this diagram
                    const placeholders = this.pendingRenders.get(id) || [];
                    placeholders.forEach(placeholder => {
                        this.replacePlaceholder(placeholder, content);
                    });

                    // Clear pending renders for this ID
                    this.pendingRenders.delete(id);
                },

                // Add a diagram to the render queue
                addToQueue: function(id, placeholder) {
                    this.renderQueue.push({ id, placeholder });

                    // Process immediately if possible
                    if (document.readyState === 'complete') {
                        this.processQueue();
                    } else {
                        // Otherwise schedule processing
                        window.requestAnimationFrame(() => this.processQueue());
                    }
                }
            };

            // Ensure queue is processed after the page loads
            if (document.readyState === 'complete') {
                window.qbinMermaidRenderer.processQueue();
            } else {
                window.addEventListener('load', () => {
                    window.qbinMermaidRenderer.processQueue();
                });
            }
        }

        // Set up mutation observer to detect when the editor adds mermaid placeholders
        const observer = new MutationObserver((mutations) => {
            let foundPlaceholders = false;

            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            // Check if this is a mermaid loading placeholder
                            if (node.classList && node.classList.contains('mermaid-loading')) {
                                foundPlaceholders = true;
                                const refId = node.getAttribute('data-mermaid-ref');
                                if (refId) {
                                    window.qbinMermaidRenderer.addToQueue(refId, node);
                                }
                            }

                            // Check child nodes as well
                            const placeholders = node.querySelectorAll('.mermaid-loading');
                            if (placeholders.length > 0) {
                                foundPlaceholders = true;
                                placeholders.forEach(placeholder => {
                                    const refId = placeholder.getAttribute('data-mermaid-ref');
                                    if (refId) {
                                        window.qbinMermaidRenderer.addToQueue(refId, placeholder);
                                    }
                                });
                            }
                        }
                    });
                }
            });

            // Process the queue if we found placeholders
            if (foundPlaceholders && window.qbinMermaidRenderer) {
                window.qbinMermaidRenderer.processQueue();
            }
        });

        // Start observing the document
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    createMermaidCompatibilityLayer() {
        if (!window.CherryCodeBlockMermaidPlugin) {
            return;
        }

        // Create API adapter - Mermaid 10.x uses a Promise-based API
        const originalRender = window.CherryCodeBlockMermaidPlugin.prototype.render;
        window.CherryCodeBlockMermaidPlugin.prototype.render = function(code, id, instance, options) {
            try {
                const self = this;
                const container = document.getElementById('mermaid-container');
                if (!container) {
                    return 'Error: Mermaid container not found';
                }

                // Create a unique ID for this diagram
                const uniqueId = `mermaid-${id || Math.random().toString(36).substr(2, 9)}-${Date.now()}`;

                // If we already have this diagram rendered in cache, return it immediately
                if (window.qbinMermaidRenderer && window.qbinMermaidRenderer.diagramCache.has(uniqueId)) {
                    return window.qbinMermaidRenderer.diagramCache.get(uniqueId);
                }

                // Create placeholder with reference ID
                const placeholder = `<div class="mermaid-loading" data-mermaid-ref="${uniqueId}">Loading diagram...</div>`;

                // Create diagram wrapper for rendering
                const wrapper = document.createElement('div');
                wrapper.id = uniqueId;
                wrapper.className = 'mermaid';
                wrapper.textContent = code;
                container.appendChild(wrapper);

                // Add to render queue using our global renderer
                if (window.qbinMermaidRenderer) {
                    // Next tick to ensure the placeholder is in the DOM
                    setTimeout(() => {
                        const placeholders = document.querySelectorAll(`.mermaid-loading[data-mermaid-ref="${uniqueId}"]`);
                        placeholders.forEach(placeholderEl => {
                            window.qbinMermaidRenderer.addToQueue(uniqueId, placeholderEl);
                        });
                    }, 0);
                }

                return placeholder;
            } catch (err) {
                console.error('Error in mermaid compatibility layer:', err);
                return `<div class="cherry-code-block-error">Mermaid error: ${err.message || String(err)}</div>`;
            }
        };
    }

    getEditorContent() {
        return window.cherry.getMarkdown();
    }

    setEditorContent(content) {
        window.cherry.setMarkdown(content);
    }

    setupEditorChangeListener() {
        // 监听编辑器内容变化，用于自动保存和上传
        let saveTimeout;
        
        const contentChangeCallback = () => {
            // 保存到本地缓存
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveToLocalCache();
            }, 1000);

            // 自动上传
            clearTimeout(this.autoUploadTimer);
            this.autoUploadTimer = setTimeout(() => {
                const content = this.getEditorContent();
                if (content && cyrb53(content) !== this.lastUploadedHash) {
                    this.handleUpload(content, "text/markdown; charset=UTF-8");
                }
            }, 2000);
        };

        let lastChangeTime = 0;
        const throttleTime = 500; // 500ms节流
        
        document.addEventListener('cherry:change', () => {
            const now = Date.now();
            if (now - lastChangeTime > throttleTime) {
                lastChangeTime = now;
                contentChangeCallback();
            }
        });
    }

    handleContentChange(content) {
        // 本地缓存防抖 (1秒)
        clearTimeout(this.saveDebounceTimeout);
        this.saveDebounceTimeout = setTimeout(() => {
            this.saveToLocalCache();
        }, 1000);

        // 自动上传防抖 (3秒)
        clearTimeout(this.uploadDebounceTimeout);
        this.uploadDebounceTimeout = setTimeout(() => {
            if (content && cyrb53(content) !== this.lastUploadedHash) {
                this.handleUpload(content, "text/markdown; charset=UTF-8");
            }
        }, 3000);
    }

    initializePasswordPanel() {
        if (this.passwordPanelInitialized) return;

        const passwordPanel = document.querySelector('.password-panel');
        if (!passwordPanel) return;

        let isInputActive = false;
        let hoverTimeout = null;
        let hideTimeout = null;

        const adjustPanelPosition = (settingsBtn) => {
            const btnRect = settingsBtn.getBoundingClientRect();
            passwordPanel.style.top = (btnRect.bottom + 10) + 'px';
            const rightOffset = window.innerWidth - btnRect.right;
            passwordPanel.style.right = (rightOffset + btnRect.width/2) + 'px';
        };

        const setupPanelEvents = () => {
            const settingsBtn = document.querySelector('.cherry-toolbar-button.cherry-toolbar-mySettings');
            if (!settingsBtn) return false;

            // 调整面板位置
            const handleResize = () => {
                if (passwordPanel.classList.contains('active')) {
                    adjustPanelPosition(settingsBtn);
                }
            };
            window.addEventListener('resize', handleResize);

            // 设置按钮悬停事件
            settingsBtn.addEventListener('mouseenter', () => {
                if (window.innerWidth <= 768) return; // 移动端不触发悬停
                clearTimeout(hideTimeout);
                adjustPanelPosition(settingsBtn);
                hoverTimeout = setTimeout(() => {
                    passwordPanel.classList.add('active');
                }, 100);
            });

            settingsBtn.addEventListener('mouseleave', () => {
                if (window.innerWidth <= 768) return;
                clearTimeout(hoverTimeout);
                if (!isInputActive && !passwordPanel.matches(':hover')) {
                    hideTimeout = setTimeout(() => {
                        passwordPanel.classList.remove('active');
                    }, 300);
                }
            });

            // 面板悬停事件
            passwordPanel.addEventListener('mouseenter', () => {
                if (window.innerWidth <= 768) return;
                clearTimeout(hideTimeout);
            });

            passwordPanel.addEventListener('mouseleave', () => {
                if (window.innerWidth <= 768) return;
                if (!isInputActive) {
                    hideTimeout = setTimeout(() => {
                        passwordPanel.classList.remove('active');
                    }, 300);
                }
            });

            // 输入框焦点事件
            const inputs = passwordPanel.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('focus', () => {
                    isInputActive = true;
                    clearTimeout(hideTimeout);
                });

                input.addEventListener('blur', () => {
                    isInputActive = false;
                    if (!passwordPanel.matches(':hover')) {
                        hideTimeout = setTimeout(() => {
                            passwordPanel.classList.remove('active');
                        }, 800);
                    }
                });
            });

            // 加密复选框交互
            this.initializeEncryptCheckbox();

            return true;
        };

        // 确保事件只绑定一次
        if (setupPanelEvents()) {
            this.passwordPanelInitialized = true;
        }
    }

    initializeEncryptCheckbox() {
        // const checkbox = document.getElementById('encrypt-checkbox');
        // const hiddenCheckbox = document.getElementById('encryptData');
        // const optionToggle = document.querySelector('.option-toggle');
        // if (optionToggle && checkbox && hiddenCheckbox) {
        //     optionToggle.addEventListener('click', () => {
        //         const isChecked = checkbox.classList.contains('checked');
        //         checkbox.classList.toggle('checked');
        //         hiddenCheckbox.checked = !isChecked;
        //     });
        // }
    }

    togglePasswordPanel(isClick = false) {
        const passwordPanel = document.querySelector('.password-panel');
        if (!passwordPanel) return;
        if (isClick) {
            passwordPanel.classList.toggle('active');
        }
    }

    applyThemeBasedOnPreference() {
        const userPreference = localStorage.getItem('qbin-theme') || 'system';
        let themeToApply;
        
        if (userPreference === 'system') {
            // Apply theme based on system preference
            themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
            // Apply user's explicit choice
            themeToApply = userPreference;
        }
        
        if (window.cherry && window.cherry.setTheme) {
            // Store original theme value
            const originalTheme = localStorage.getItem('qbin-theme');
            
            // Apply the theme
            window.cherry.setTheme(themeToApply);
            window.cherry.setCodeBlockTheme(`one-${themeToApply}`);

            // Restore "system" if that was the original preference
            if (originalTheme === 'system') {
                localStorage.setItem('qbin-theme', 'system');
            }
        }
    }

    setupThemeListener() {
        // Listen for system preference changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
            // Only react to system changes if the user preference is 'system'
            if (localStorage.getItem('qbin-theme') === 'system' || !localStorage.getItem('qbin-theme')) {
                this.applyThemeBasedOnPreference();
            }
        });

        // Listen for explicit theme changes from other tabs/windows
        window.addEventListener('storage', (event) => {
            if (event.key === 'qbin-theme') {
                this.applyThemeBasedOnPreference();
            }
        });

        // Setup the global theme toggler
        if (!window.qbinToggleTheme) {
            window.qbinToggleTheme = (theme) => {
                localStorage.setItem('qbin-theme', theme);
                this.applyThemeBasedOnPreference();
            };
        }
        
        // Apply the initial theme
        this.applyThemeBasedOnPreference();
    }
}

new QBinMDEditor();
