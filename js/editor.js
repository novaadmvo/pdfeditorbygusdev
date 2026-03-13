pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let canvas;
let originalPdfWidth = 0;
let originalPdfHeight = 0;
let currentZoom = 1;

// VARIABLES MULTI-PÁGINA
let pdfDocJs = null;
let currentPage = 1;
let totalPages = 0;
let pagesState = {}; // La "caja fuerte" que guarda los datos de cada página

let isDraggingScreen = false;
let lastClientX = 0;
let lastClientY = 0;

const misImagenesDeCarpeta = [
    'assets/CARRO.png', 
    'assets/CAMION BLANCO.PNG',
    'assets/CAMIONETA BLANCA.PNG',
    'assets/CAMIONETA ROJA.PNG',
    'assets/CARRO AMARILLO.PNG',
    'assets/CARRO AZUL.PNG',
    'assets/CARRO GRIS.PNG',
    'assets/CARRO NARNJA.PNG',
    'assets/CARRO ROJO.PNG',
    'assets/CARRO VERDE.PNG',
    'assets/GRUA DOS.PNG',
    'assets/PATRULLA DOS.PNG',
    'assets/PATRULLA UNO.PNG',
    'assets/PIPA.PNG',
    'assets/TAXI UNO.PNG',
    'assets/CALLE 1.PNG',
    'assets/CALLE 2.PNG',
    'assets/CALLE 3.PNG',
    'assets/CALLE 4.PNG',
    'assets/CALLE 5.PNG',
    
];

window.onload = () => {
    loadFolderImages();
    setupMobileControls();
};

function getClientCoords(evt) {
    if (evt.touches && evt.touches.length > 0) return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    return { x: evt.clientX || 0, y: evt.clientY || 0 };
}

function initCanvas(imgWidth, imgHeight) {
    if (canvas) { canvas.dispose(); }

    canvas = new fabric.Canvas('pdf-canvas', {
        width: imgWidth,
        height: imgHeight,
        backgroundColor: '#ffffff',
        selection: false 
    });

    fabric.Object.prototype.set({
        transparentCorners: false, cornerColor: '#3b82f6', cornerStrokeColor: '#ffffff',
        borderColor: '#3b82f6', cornerSize: 16, padding: 10, cornerStyle: 'circle'
    });

    // MOTOR DE SCROLL
    canvas.on('mouse:down', function(opt) {
        if (!opt.target) {
            isDraggingScreen = true;
            let coords = getClientCoords(opt.e);
            lastClientX = coords.x;
            lastClientY = coords.y;
        }
    });

    canvas.on('mouse:move', function(opt) {
        if (isDraggingScreen) {
            let coords = getClientCoords(opt.e);
            let workspace = document.getElementById('workspace');
            workspace.scrollLeft += (lastClientX - coords.x);
            workspace.scrollTop += (lastClientY - coords.y);
            lastClientX = coords.x;
            lastClientY = coords.y;
        }
    });

    canvas.on('mouse:up', () => isDraggingScreen = false);
}

function loadFolderImages() {
    const container = document.getElementById('assets-container');
    if(misImagenesDeCarpeta.length === 0) return container.innerHTML = "<span style='color:var(--text-muted); font-size:12px; margin:auto;'>Sin imágenes</span>";
    
    misImagenesDeCarpeta.forEach(ruta => {
        const div = document.createElement('div');
        div.className = 'asset-item';
        div.innerHTML = `<img src="${ruta}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><text x=\\'50\\' y=\\'55\\' font-size=\\'12\\' text-anchor=\\'middle\\'>Error</text></svg>'">`;
        div.onclick = () => addImageToCanvas(ruta);
        container.appendChild(div);
    });
}

// ==========================================
// 📄 CARGA Y NAVEGACIÓN DE PDF MULTI-PÁGINA
// ==========================================
document.getElementById('pdf-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('upload-placeholder').style.display = 'none';
    document.getElementById('btn-save').innerHTML = "⏳ Carg...";

    const reader = new FileReader();
    reader.onload = async function() {
        try {
            const loadingTask = pdfjsLib.getDocument(new Uint8Array(this.result));
            pdfDocJs = await loadingTask.promise;
            
            totalPages = pdfDocJs.numPages;
            currentPage = 1;
            pagesState = {}; // Limpiamos la caja fuerte para el nuevo documento

            document.getElementById('page-nav').style.display = 'flex';
            
            await renderPage(currentPage);
        } catch (error) {
            alert("Error al leer PDF.");
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(file);
});

// FUNCIÓN CLAVE: Guarda el estado, renderiza el fondo, y restaura el estado
async function renderPage(pageNum) {
    document.getElementById('btn-save').innerHTML = "⏳ Cargando...";
    document.getElementById('page-indicator').innerText = `Pág. ${pageNum} / ${totalPages}`;

    const page = await pdfDocJs.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.5 });
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;
    
    await page.render({ canvasContext: tempCanvas.getContext('2d'), viewport }).promise;

    fabric.Image.fromURL(tempCanvas.toDataURL('image/jpeg', 0.9), (bgImg) => {
        originalPdfWidth = bgImg.width;
        originalPdfHeight = bgImg.height;
        
        initCanvas(originalPdfWidth, originalPdfHeight);
        
        // Ponemos la imagen del PDF como fondo
        canvas.setBackgroundImage(bgImg, canvas.renderAll.bind(canvas));
        
        // Si hay datos en la caja fuerte para esta página, los restauramos
        if (pagesState[pageNum]) {
            canvas.loadFromJSON(pagesState[pageNum], () => {
                // Es vital reasignar el fondo porque el JSON de Fabric a veces lo sobreescribe
                canvas.setBackgroundImage(bgImg, canvas.renderAll.bind(canvas));
            });
        }

        const workspace = document.querySelector('.workspace');
        currentZoom = (workspace.clientWidth - 40) / originalPdfWidth;
        applyZoom();
        
        document.getElementById('btn-save').innerHTML = "Guardar";
    });
}

function saveCurrentPageState() {
    if (!canvas) return;
    // Guardamos absolutamente todo lo que esté en el canvas actual en formato JSON
    pagesState[currentPage] = JSON.stringify(canvas.toJSON());
}

async function prevPage() {
    if (currentPage <= 1) return;
    saveCurrentPageState(); // Guardar antes de cambiar
    currentPage--;
    await renderPage(currentPage);
}

async function nextPage() {
    if (currentPage >= totalPages) return;
    saveCurrentPageState(); // Guardar antes de cambiar
    currentPage++;
    await renderPage(currentPage);
}

// ==========================================
// 📱 CONTROLES UI
// ==========================================
function setupMobileControls() {
    const menu = document.getElementById('contextual-menu');
    const btnEdit = document.getElementById('btn-edit');

    setInterval(() => {
        if (!canvas) return;
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
            menu.classList.add('show');
            btnEdit.style.display = (activeObj.type === 'i-text' || activeObj.type === 'text') ? 'flex' : 'none';
        } else {
            menu.classList.remove('show');
        }
    }, 200);
}

function deleteSelected() {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
        activeObjects.forEach((obj) => canvas.remove(obj));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
    }
}

function editSelectedText() {
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
        const nuevoTexto = prompt("Escribe tu texto:", activeObj.text);
        if (nuevoTexto !== null && nuevoTexto.trim() !== "") {
            activeObj.set('text', nuevoTexto);
            canvas.requestRenderAll();
        }
    }
}

function toggleDock() { document.getElementById('bottom-dock').classList.toggle('collapsed'); }

// ==========================================
// ✏️ AGREGAR ELEMENTOS
// ==========================================
function addText() {
    if(!canvas) return alert("Sube un PDF primero.");
    const center = canvas.getVpCenter();
    const text = new fabric.IText('Toca Editar para cambiar', {
        left: center.x, top: center.y, originX: 'center', originY: 'center',
        fontSize: 35, fill: '#000000', fontFamily: 'Inter', fontWeight: 'bold', editable: false 
    });
    canvas.add(text).setActiveObject(text);
    canvas.requestRenderAll();
}

function addImageToCanvas(src) {
    if(!canvas) return alert("Sube un PDF primero.");
    fabric.Image.fromURL(src, (img) => {
        if (!img) return;
        const center = canvas.getVpCenter();
        img.scaleToWidth(150);
        img.set({ left: center.x, top: center.y, originX: 'center', originY: 'center' });
        canvas.add(img).setActiveObject(img);
        canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' }); 
}

function changeZoom(amount) {
    if(!canvas) return;
    currentZoom += amount;
    if (currentZoom < 0.1) currentZoom = 0.1;
    if (currentZoom > 4) currentZoom = 4;
    applyZoom();
}

function applyZoom() {
    if(!canvas) return;
    canvas.setZoom(currentZoom);
    canvas.setWidth(originalPdfWidth * currentZoom);
    canvas.setHeight(originalPdfHeight * currentZoom);
    document.getElementById('zoom-display').innerText = Math.round(currentZoom * 100) + '%';
}

// ==========================================
// 📥 EXPORTACIÓN MULTI-PÁGINA INVISIBLE Y HD
// ==========================================
async function exportMultiPagePDF() {
    if(!pdfDocJs) return;
    
    // Guardamos la página en la que el usuario esté parado en este momento
    saveCurrentPageState(); 
    
    const btn = document.getElementById('btn-save');
    
    try {
        const { PDFDocument } = PDFLib;
        const finalPdf = await PDFDocument.create();

        // Procesamos página por página EN SEGUNDO PLANO
        for (let i = 1; i <= totalPages; i++) {
            btn.innerHTML = `⏳ Pág ${i}/${totalPages}`;
            
            // 1. Extraemos el fondo de la página i
            const page = await pdfDocJs.getPage(i);
            const viewport = page.getViewport({ scale: 2.5 });
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = viewport.width;
            tempCanvas.height = viewport.height;
            await page.render({ canvasContext: tempCanvas.getContext('2d'), viewport }).promise;

            // 2. Creamos un "Canvas Fantasma" (StaticCanvas) para armar la imagen final sin molestar la vista
            const exportCanvas = new fabric.StaticCanvas(null, {
                width: tempCanvas.width,
                height: tempCanvas.height
            });

            // 3. Ponemos el fondo
            await new Promise(resolve => {
                fabric.Image.fromURL(tempCanvas.toDataURL('image/jpeg', 1.0), (bgImg) => {
                    exportCanvas.setBackgroundImage(bgImg, resolve);
                });
            });

            // 4. Si el usuario editó esta página, le montamos los objetos guardados
            if (pagesState[i]) {
                await new Promise(resolve => {
                    exportCanvas.loadFromJSON(pagesState[i], resolve);
                });
            }

            // 5. Tomamos la "foto" 4K y la metemos al nuevo PDF
            const dataUrl = exportCanvas.toDataURL({ format: 'jpeg', quality: 1.0, multiplier: 3 });
            const imageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
            const pdfImg = await finalPdf.embedJpg(imageBytes);
            
            const pdfPage = finalPdf.addPage([exportCanvas.width, exportCanvas.height]);
            pdfPage.drawImage(pdfImg, { x: 0, y: 0, width: exportCanvas.width, height: exportCanvas.height });
        }

        // 6. Descargar el documento final
        btn.innerHTML = "⏳ Guardando...";
        const pdfBytes = await finalPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'GusDev_MultiPagina.pdf';
        link.click();
        
    } catch (e) {
        alert("Error crítico al exportar.");
        console.error(e);
    } finally {
        btn.innerHTML = "Guardar";
    }
}