const STORAGE_KEY = 'gastos:movimientos';
const STORAGE_KEY_PRESUPUESTOS = 'gastos:presupuestos';

const CATEGORIAS = {
    ingreso: ['Salario', 'Freelance', 'Inversiones', 'Regalo', 'Otros'],
    gasto:   ['Comida', 'Transporte', 'Vivienda', 'Ocio', 'Salud', 'Servicios', 'Otros']
};

const TIPOS_VALIDOS = ['ingreso', 'gasto'];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const NOMBRES_MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const formulario        = document.getElementById('agregar-movimiento');
const inputDescripcion  = document.getElementById('descripcion');
const inputMonto        = document.getElementById('monto');
const inputCategoria    = document.getElementById('categoria');
const inputFecha        = document.getElementById('fecha');
const radiosTipo        = document.querySelectorAll('input[name="tipo"]');

const listadoMovimientos = document.querySelector('#movimientos ul');
const spanIngresos       = document.getElementById('total-ingresos');
const spanGastos         = document.getElementById('total-gastos');
const spanBalance        = document.getElementById('balance');
const cardBalance        = document.getElementById('balance-card');

const filtrosContainer = document.getElementById('filtros');
const filtroDesde      = document.getElementById('filtro-desde');
const filtroHasta      = document.getElementById('filtro-hasta');
const filtroCategoria  = document.getElementById('filtro-categoria');
const filtroTipo       = document.getElementById('filtro-tipo');
const btnFiltroReset   = document.getElementById('filtro-reset');

const btnExportar    = document.getElementById('exportar');
const btnImportar    = document.getElementById('importar');
const inputImportar  = document.getElementById('importar-file');

const progresoLista        = document.getElementById('progreso-lista');
const progresoMesLabel     = document.getElementById('progreso-mes-label');
const presupuestosInputs   = document.getElementById('presupuestos-inputs');


function validarMovimiento(m) {
    return m
        && typeof m.id === 'string' && m.id.length > 0
        && TIPOS_VALIDOS.includes(m.tipo)
        && typeof m.monto === 'number' && m.monto > 0 && isFinite(m.monto)
        && typeof m.categoria === 'string' && m.categoria.length > 0
        && typeof m.descripcion === 'string'
        && typeof m.fecha === 'string' && FECHA_REGEX.test(m.fecha);
}

function nuevoId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function fechaHoy() {
    return new Date().toISOString().slice(0, 10);
}

function mesActual() {
    return new Date().toISOString().slice(0, 7);
}

function nombreMes(mesIso) {
    const [a, m] = mesIso.split('-');
    return `${NOMBRES_MESES[Number(m) - 1]} ${a}`;
}

function formatearMonto(n) {
    return Number(n).toFixed(2);
}


class Finanzas {
    constructor() {
        this.movimientos = this.cargar();
        this.presupuestos = this.cargarPresupuestos();
    }

    cargar() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(validarMovimiento);
        } catch (err) {
            console.warn('No se pudo leer localStorage:', err);
            return [];
        }
    }

    guardar() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.movimientos));
    }

    cargarPresupuestos() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PRESUPUESTOS);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
            const out = {};
            for (const cat of CATEGORIAS.gasto) {
                const v = Number(parsed[cat]);
                if (v > 0 && isFinite(v)) out[cat] = v;
            }
            return out;
        } catch (err) {
            console.warn('No se pudo leer presupuestos:', err);
            return {};
        }
    }

    guardarPresupuestos() {
        localStorage.setItem(STORAGE_KEY_PRESUPUESTOS, JSON.stringify(this.presupuestos));
    }

    setPresupuesto(categoria, monto) {
        const n = Number(monto);
        if (!n || n <= 0 || !isFinite(n)) delete this.presupuestos[categoria];
        else this.presupuestos[categoria] = n;
        this.guardarPresupuestos();
    }

    gastosMesPorCategoria(mes = mesActual()) {
        const acc = {};
        for (const m of this.movimientos) {
            if (m.tipo !== 'gasto') continue;
            if (!m.fecha.startsWith(mes)) continue;
            acc[m.categoria] = (acc[m.categoria] || 0) + m.monto;
        }
        return acc;
    }

    nuevoMovimiento(mov) {
        this.movimientos.push(mov);
        this.guardar();
    }

    eliminarMovimiento(id) {
        this.movimientos = this.movimientos.filter(m => m.id !== id);
        this.guardar();
    }

    reemplazarTodo(arr) {
        if (!Array.isArray(arr)) throw new Error('No es un array');
        if (!arr.every(validarMovimiento)) throw new Error('Algún movimiento es inválido');
        this.movimientos = arr;
        this.guardar();
    }

    totales(movs = this.movimientos) {
        let ingresos = 0;
        let gastos = 0;
        for (const m of movs) {
            if (m.tipo === 'ingreso') ingresos += m.monto;
            else gastos += m.monto;
        }
        return { ingresos, gastos, balance: ingresos - gastos };
    }

    filtrar({ desde, hasta, categoria, tipo }) {
        return this.movimientos.filter(m => {
            if (desde && m.fecha < desde) return false;
            if (hasta && m.fecha > hasta) return false;
            if (categoria && categoria !== 'todas' && m.categoria !== categoria) return false;
            if (tipo && tipo !== 'todos' && m.tipo !== tipo) return false;
            return true;
        });
    }

    categoriasUsadas() {
        const set = new Set(this.movimientos.map(m => m.categoria));
        return [...set].sort();
    }
}


class UI {
    poblarCategorias(selectEl, tipo, opciones = {}) {
        const { includeAll = false, allLabel = 'Todas' } = opciones;
        const lista = includeAll
            ? [...new Set([...CATEGORIAS.ingreso, ...CATEGORIAS.gasto])].sort()
            : CATEGORIAS[tipo];

        const valorPrevio = selectEl.value;
        selectEl.innerHTML = '';

        if (includeAll) {
            const opt = document.createElement('option');
            opt.value = 'todas';
            opt.textContent = allLabel;
            selectEl.appendChild(opt);
        }

        for (const cat of lista) {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            selectEl.appendChild(opt);
        }

        if ([...selectEl.options].some(o => o.value === valorPrevio)) {
            selectEl.value = valorPrevio;
        }
    }

    imprimirAlerta(mensaje, tipo = 'agregado') {
        document.querySelectorAll('.primario .alert.flash').forEach(el => el.remove());

        const div = document.createElement('div');
        div.className = `text-center alert flash ${tipo === 'error' ? 'alert-danger' : 'alert-success'}`;
        div.textContent = mensaje;

        document.querySelector('.primario').insertBefore(div, formulario);
        setTimeout(() => div.remove(), 3000);
    }

    renderMovimientos(movs) {
        this.limpiarHTML(listadoMovimientos);

        if (movs.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-group-item text-center text-muted';
            li.textContent = 'Sin movimientos para mostrar';
            listadoMovimientos.appendChild(li);
            return;
        }

        const ordenados = [...movs].sort((a, b) => b.fecha.localeCompare(a.fecha));

        for (const m of ordenados) {
            const li = document.createElement('li');
            li.className = `list-group-item movimiento ${m.tipo}`;
            li.dataset.id = m.id;

            const signo = m.tipo === 'ingreso' ? '+' : '-';
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div>${escapeHtml(m.descripcion) || '<em class="text-muted">(sin descripción)</em>'}</div>
                        <div class="meta">${m.fecha} · <span class="badge badge-secondary">${escapeHtml(m.categoria)}</span></div>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="monto mr-3">${signo}$${formatearMonto(m.monto)}</span>
                        <button type="button" class="btn btn-sm btn-outline-danger borrar-movimiento">Borrar</button>
                    </div>
                </div>
            `;
            listadoMovimientos.appendChild(li);
        }
    }

    actualizarTotales({ ingresos, gastos, balance }) {
        spanIngresos.textContent = formatearMonto(ingresos);
        spanGastos.textContent   = formatearMonto(gastos);
        spanBalance.textContent  = formatearMonto(balance);

        cardBalance.classList.remove('alert-info', 'alert-success', 'alert-danger');
        if (balance > 0) cardBalance.classList.add('alert-success');
        else if (balance < 0) cardBalance.classList.add('alert-danger');
        else cardBalance.classList.add('alert-info');
    }

    renderPresupuestosInputs(presupuestos) {
        presupuestosInputs.innerHTML = '';
        for (const cat of CATEGORIAS.gasto) {
            const row = document.createElement('div');
            row.className = 'form-row align-items-center mb-2';
            row.innerHTML = `
                <label class="col-5 col-form-label col-form-label-sm mb-0">${escapeHtml(cat)}</label>
                <div class="col-7">
                    <div class="input-group input-group-sm">
                        <div class="input-group-prepend"><span class="input-group-text">$</span></div>
                        <input type="number" min="0" step="0.01" class="form-control presupuesto-input"
                               data-categoria="${escapeHtml(cat)}"
                               value="${presupuestos[cat] ? presupuestos[cat] : ''}"
                               placeholder="sin tope">
                    </div>
                </div>
            `;
            presupuestosInputs.appendChild(row);
        }
    }

    renderProgresoMes({ gastosPorCat, presupuestos, mes }) {
        progresoMesLabel.textContent = `(${nombreMes(mes)})`;
        progresoLista.innerHTML = '';

        const categorias = new Set([
            ...Object.keys(gastosPorCat),
            ...Object.keys(presupuestos)
        ]);

        if (categorias.size === 0) {
            progresoLista.innerHTML = '<p class="small text-muted mb-0">Todavía no cargaste gastos este mes ni configuraste topes.</p>';
            return;
        }

        const filas = [...categorias].map(cat => {
            const gasto = gastosPorCat[cat] || 0;
            const tope  = presupuestos[cat] || 0;
            return { cat, gasto, tope, pct: tope > 0 ? (gasto / tope) * 100 : null };
        }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

        for (const { cat, gasto, tope, pct } of filas) {
            const row = document.createElement('div');
            row.className = 'progreso-row mb-2';

            if (tope > 0) {
                const clase = pct >= 100 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-success';
                const ancho = Math.min(pct, 100).toFixed(0);
                row.innerHTML = `
                    <div class="d-flex justify-content-between small">
                        <span><strong>${escapeHtml(cat)}</strong></span>
                        <span>$${formatearMonto(gasto)} / $${formatearMonto(tope)} (${pct.toFixed(0)}%)</span>
                    </div>
                    <div class="progress" style="height: 8px;">
                        <div class="progress-bar ${clase}" role="progressbar" style="width: ${ancho}%"></div>
                    </div>
                `;
            } else {
                row.innerHTML = `
                    <div class="d-flex justify-content-between small text-muted">
                        <span><strong>${escapeHtml(cat)}</strong></span>
                        <span>$${formatearMonto(gasto)} (sin tope)</span>
                    </div>
                `;
            }
            progresoLista.appendChild(row);
        }
    }

    limpiarHTML(ul) {
        while (ul.firstChild) ul.removeChild(ul.firstChild);
    }
}


function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}


const finanzas = new Finanzas();
const ui = new UI();


function tipoSeleccionado() {
    return document.querySelector('input[name="tipo"]:checked').value;
}

function leerFiltros() {
    return {
        desde: filtroDesde.value || '',
        hasta: filtroHasta.value || '',
        categoria: filtroCategoria.value || 'todas',
        tipo: filtroTipo.value || 'todos'
    };
}

function refrescarVista() {
    const filtrados = finanzas.filtrar(leerFiltros());
    ui.renderMovimientos(filtrados);
    ui.actualizarTotales(finanzas.totales(filtrados));
    refrescarProgreso();
}

function refrescarProgreso() {
    const mes = mesActual();
    ui.renderProgresoMes({
        gastosPorCat: finanzas.gastosMesPorCategoria(mes),
        presupuestos: finanzas.presupuestos,
        mes
    });
}

function chequearTope(mov) {
    if (mov.tipo !== 'gasto') return false;
    if (!mov.fecha.startsWith(mesActual())) return false;
    const tope = finanzas.presupuestos[mov.categoria];
    if (!tope) return false;
    const gastado = (finanzas.gastosMesPorCategoria()[mov.categoria] || 0);
    const pct = (gastado / tope) * 100;
    if (pct >= 100) {
        ui.imprimirAlerta(`Te pasaste del tope de ${mov.categoria} este mes: $${formatearMonto(gastado)} / $${formatearMonto(tope)}`, 'error');
        return true;
    }
    if (pct >= 90) {
        ui.imprimirAlerta(`Ojo: ya vas ${pct.toFixed(0)}% del tope de ${mov.categoria} este mes`, 'error');
        return true;
    }
    return false;
}

function refrescarFiltroCategorias() {
    const usadas = finanzas.categoriasUsadas();
    const valorPrevio = filtroCategoria.value;
    filtroCategoria.innerHTML = '';

    const optAll = document.createElement('option');
    optAll.value = 'todas';
    optAll.textContent = 'Todas';
    filtroCategoria.appendChild(optAll);

    for (const cat of usadas) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filtroCategoria.appendChild(opt);
    }

    if ([...filtroCategoria.options].some(o => o.value === valorPrevio)) {
        filtroCategoria.value = valorPrevio;
    }
}


function agregarMovimiento(e) {
    e.preventDefault();

    const tipo = tipoSeleccionado();
    const descripcion = inputDescripcion.value.trim();
    const monto = Number(inputMonto.value);
    const categoria = inputCategoria.value;
    const fecha = inputFecha.value;

    if (!descripcion) {
        ui.imprimirAlerta('La descripción es obligatoria', 'error');
        return;
    }
    if (!monto || monto <= 0 || isNaN(monto)) {
        ui.imprimirAlerta('El monto debe ser mayor a 0', 'error');
        return;
    }
    if (!categoria) {
        ui.imprimirAlerta('Elegí una categoría', 'error');
        return;
    }
    if (!fecha || !FECHA_REGEX.test(fecha)) {
        ui.imprimirAlerta('Fecha inválida', 'error');
        return;
    }

    const mov = { id: nuevoId(), tipo, descripcion, monto, categoria, fecha };
    finanzas.nuevoMovimiento(mov);

    refrescarFiltroCategorias();
    refrescarVista();

    inputDescripcion.value = '';
    inputMonto.value = '';
    inputFecha.value = fechaHoy();

    chequearTope(mov) || ui.imprimirAlerta('Movimiento agregado');
}

function eliminarMovimiento(e) {
    if (!e.target.classList.contains('borrar-movimiento')) return;
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    finanzas.eliminarMovimiento(li.dataset.id);
    refrescarFiltroCategorias();
    refrescarVista();
}

function aplicarFiltros() {
    refrescarVista();
}

function resetearFiltros() {
    filtroDesde.value = '';
    filtroHasta.value = '';
    filtroCategoria.value = 'todas';
    filtroTipo.value = 'todos';
    refrescarVista();
}

function exportarJSON() {
    const data = JSON.stringify(finanzas.movimientos, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanzas-${fechaHoy()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function importarJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            if (!Array.isArray(parsed)) throw new Error('El JSON debe ser un array');
            if (!parsed.every(validarMovimiento)) throw new Error('Algún movimiento es inválido');

            const ok = confirm(`Esto reemplazará tus movimientos actuales (${finanzas.movimientos.length}) por los del archivo (${parsed.length}). ¿Continuar?`);
            if (!ok) return;

            finanzas.reemplazarTodo(parsed);
            refrescarFiltroCategorias();
            refrescarVista();
            ui.imprimirAlerta('Datos importados');
        } catch (err) {
            console.error(err);
            ui.imprimirAlerta('Archivo JSON inválido', 'error');
        }
    };
    reader.onerror = () => ui.imprimirAlerta('No se pudo leer el archivo', 'error');
    reader.readAsText(file);
}


function onPresupuestoInput(e) {
    const input = e.target;
    if (!input.classList.contains('presupuesto-input')) return;
    const cat = input.dataset.categoria;
    finanzas.setPresupuesto(cat, input.value);
    refrescarProgreso();
}

function eventListeners() {
    document.addEventListener('DOMContentLoaded', () => {
        inputFecha.value = fechaHoy();
        ui.poblarCategorias(inputCategoria, tipoSeleccionado());
        ui.renderPresupuestosInputs(finanzas.presupuestos);
        refrescarFiltroCategorias();
        refrescarVista();
    });

    presupuestosInputs.addEventListener('input', onPresupuestoInput);
    presupuestosInputs.addEventListener('change', onPresupuestoInput);

    radiosTipo.forEach(r => r.addEventListener('change', () => {
        ui.poblarCategorias(inputCategoria, tipoSeleccionado());
    }));

    formulario.addEventListener('submit', agregarMovimiento);
    listadoMovimientos.addEventListener('click', eliminarMovimiento);

    filtrosContainer.addEventListener('change', aplicarFiltros);
    filtrosContainer.addEventListener('input', aplicarFiltros);
    btnFiltroReset.addEventListener('click', resetearFiltros);

    btnExportar.addEventListener('click', exportarJSON);
    btnImportar.addEventListener('click', () => inputImportar.click());
    inputImportar.addEventListener('change', () => {
        const file = inputImportar.files[0];
        if (file) importarJSON(file);
        inputImportar.value = '';
    });
}

eventListeners();
