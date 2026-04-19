const STORAGE_KEY = 'gastos:movimientos';
const STORAGE_KEY_PRESUPUESTOS = 'gastos:presupuestos';
const STORAGE_KEY_RECURRENTES = 'gastos:recurrentes';
const STORAGE_KEY_PLANTILLAS  = 'gastos:plantillas';

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

const accesosRapidos       = document.getElementById('accesos-rapidos');
const recurrentesLista     = document.getElementById('recurrentes-lista');
const recurrentesForm      = document.getElementById('recurrentes-form');
const recTipo              = document.getElementById('rec-tipo');
const recDescripcion       = document.getElementById('rec-descripcion');
const recMonto             = document.getElementById('rec-monto');
const recCategoria         = document.getElementById('rec-categoria');
const recDia               = document.getElementById('rec-dia');
const plantillasLista      = document.getElementById('plantillas-lista');
const plantillasForm       = document.getElementById('plantillas-form');
const plTipo               = document.getElementById('pl-tipo');
const plDescripcion        = document.getElementById('pl-descripcion');
const plMonto              = document.getElementById('pl-monto');
const plCategoria          = document.getElementById('pl-categoria');


function validarMovimiento(m) {
    return m
        && typeof m.id === 'string' && m.id.length > 0
        && TIPOS_VALIDOS.includes(m.tipo)
        && typeof m.monto === 'number' && m.monto > 0 && isFinite(m.monto)
        && typeof m.categoria === 'string' && m.categoria.length > 0
        && typeof m.descripcion === 'string'
        && typeof m.fecha === 'string' && FECHA_REGEX.test(m.fecha);
}

function validarRecurrente(r) {
    return r
        && typeof r.id === 'string' && r.id.length > 0
        && TIPOS_VALIDOS.includes(r.tipo)
        && typeof r.monto === 'number' && r.monto > 0 && isFinite(r.monto)
        && typeof r.categoria === 'string' && r.categoria.length > 0
        && typeof r.descripcion === 'string'
        && Number.isInteger(r.diaDelMes) && r.diaDelMes >= 1 && r.diaDelMes <= 31
        && typeof r.activo === 'boolean'
        && (r.ultimoMesGenerado === null || (typeof r.ultimoMesGenerado === 'string' && /^\d{4}-\d{2}$/.test(r.ultimoMesGenerado)));
}

function validarPlantilla(p) {
    return p
        && typeof p.id === 'string' && p.id.length > 0
        && TIPOS_VALIDOS.includes(p.tipo)
        && typeof p.categoria === 'string' && p.categoria.length > 0
        && typeof p.descripcion === 'string'
        && (p.monto === 0 || (typeof p.monto === 'number' && p.monto > 0 && isFinite(p.monto)));
}

function ultimoDiaDelMes(ano, mes) {
    return new Date(ano, mes, 0).getDate();
}

function siguienteMes(ano, mes) {
    return mes === 12 ? [ano + 1, 1] : [ano, mes + 1];
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
        this.recurrentes = this.cargarRecurrentes();
        this.plantillas = this.cargarPlantillas();
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

    cargarRecurrentes() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_RECURRENTES);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(validarRecurrente);
        } catch (err) { return []; }
    }

    guardarRecurrentes() {
        localStorage.setItem(STORAGE_KEY_RECURRENTES, JSON.stringify(this.recurrentes));
    }

    agregarRecurrente(r) {
        this.recurrentes.push(r);
        this.guardarRecurrentes();
    }

    eliminarRecurrente(id) {
        this.recurrentes = this.recurrentes.filter(r => r.id !== id);
        this.guardarRecurrentes();
    }

    toggleRecurrente(id) {
        const r = this.recurrentes.find(r => r.id === id);
        if (r) { r.activo = !r.activo; this.guardarRecurrentes(); }
    }

    cargarPlantillas() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PLANTILLAS);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(validarPlantilla);
        } catch (err) { return []; }
    }

    guardarPlantillas() {
        localStorage.setItem(STORAGE_KEY_PLANTILLAS, JSON.stringify(this.plantillas));
    }

    agregarPlantilla(p) {
        this.plantillas.push(p);
        this.guardarPlantillas();
    }

    eliminarPlantilla(id) {
        this.plantillas = this.plantillas.filter(p => p.id !== id);
        this.guardarPlantillas();
    }

    // Genera los movimientos de los fijos que corresponden desde el último mes
    // generado hasta hoy. Devuelve la cantidad generada.
    procesarRecurrentes() {
        const hoy = fechaHoy();
        const [hoyAno, hoyMes] = hoy.split('-').map(Number);
        let generados = 0;
        let cambiaronRecurrentes = false;

        for (const r of this.recurrentes) {
            if (!r.activo) continue;

            let ano, mes;
            if (r.ultimoMesGenerado) {
                const [a, m] = r.ultimoMesGenerado.split('-').map(Number);
                [ano, mes] = siguienteMes(a, m);
            } else {
                ano = hoyAno;
                mes = hoyMes;
            }

            while (ano < hoyAno || (ano === hoyAno && mes <= hoyMes)) {
                const dia = Math.min(r.diaDelMes, ultimoDiaDelMes(ano, mes));
                const fecha = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;

                if (fecha > hoy) break;

                this.movimientos.push({
                    id: nuevoId(),
                    tipo: r.tipo,
                    categoria: r.categoria,
                    descripcion: r.descripcion,
                    monto: r.monto,
                    fecha,
                    origenRecurrente: r.id
                });
                r.ultimoMesGenerado = `${ano}-${String(mes).padStart(2,'0')}`;
                generados++;
                cambiaronRecurrentes = true;

                [ano, mes] = siguienteMes(ano, mes);
            }
        }

        if (generados > 0) this.guardar();
        if (cambiaronRecurrentes) this.guardarRecurrentes();
        return generados;
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

    reemplazarBundle(bundle) {
        if (!bundle || typeof bundle !== 'object') throw new Error('Formato inválido');
        if (!Array.isArray(bundle.movimientos)) throw new Error('Falta el array de movimientos');
        if (!bundle.movimientos.every(validarMovimiento)) throw new Error('Algún movimiento es inválido');

        const presupuestos = {};
        if (bundle.presupuestos && typeof bundle.presupuestos === 'object') {
            for (const cat of CATEGORIAS.gasto) {
                const v = Number(bundle.presupuestos[cat]);
                if (v > 0 && isFinite(v)) presupuestos[cat] = v;
            }
        }
        const recurrentes = Array.isArray(bundle.recurrentes)
            ? bundle.recurrentes.filter(validarRecurrente) : [];
        const plantillas = Array.isArray(bundle.plantillas)
            ? bundle.plantillas.filter(validarPlantilla) : [];

        this.movimientos  = bundle.movimientos;
        this.presupuestos = presupuestos;
        this.recurrentes  = recurrentes;
        this.plantillas   = plantillas;

        this.guardar();
        this.guardarPresupuestos();
        this.guardarRecurrentes();
        this.guardarPlantillas();
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

    renderAccesosRapidos(plantillas) {
        accesosRapidos.innerHTML = '';
        if (plantillas.length === 0) return;

        const label = document.createElement('div');
        label.className = 'small text-muted mb-1';
        label.textContent = 'Accesos rápidos:';
        accesosRapidos.appendChild(label);

        const wrap = document.createElement('div');
        wrap.className = 'chips';
        for (const p of plantillas) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn btn-sm chip chip-${p.tipo}`;
            btn.dataset.id = p.id;
            const montoTxt = p.monto > 0 ? ` $${formatearMonto(p.monto)}` : '';
            btn.textContent = `+ ${p.descripcion}${montoTxt}`;
            wrap.appendChild(btn);
        }
        accesosRapidos.appendChild(wrap);
    }

    renderRecurrentesLista(recurrentes) {
        recurrentesLista.innerHTML = '';
        if (recurrentes.length === 0) {
            recurrentesLista.innerHTML = '<p class="small text-muted mb-0">Todavía no agregaste movimientos fijos.</p>';
            return;
        }
        const ul = document.createElement('ul');
        ul.className = 'list-group list-group-flush';
        for (const r of recurrentes) {
            const li = document.createElement('li');
            li.className = `list-group-item px-2 py-2 small recurrente ${r.activo ? '' : 'inactivo'}`;
            li.dataset.id = r.id;
            const signo = r.tipo === 'ingreso' ? '+' : '-';
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${escapeHtml(r.descripcion)}</strong>
                        <span class="text-muted"> · ${escapeHtml(r.categoria)} · día ${r.diaDelMes}</span>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="mr-2 ${r.tipo === 'ingreso' ? 'text-success' : 'text-danger'}">${signo}$${formatearMonto(r.monto)}</span>
                        <button type="button" class="btn btn-sm btn-outline-secondary mr-1 toggle-recurrente">${r.activo ? 'Pausar' : 'Activar'}</button>
                        <button type="button" class="btn btn-sm btn-outline-danger borrar-recurrente">✕</button>
                    </div>
                </div>
            `;
            ul.appendChild(li);
        }
        recurrentesLista.appendChild(ul);
    }

    renderPlantillasLista(plantillas) {
        plantillasLista.innerHTML = '';
        if (plantillas.length === 0) {
            plantillasLista.innerHTML = '<p class="small text-muted mb-0">Todavía no agregaste accesos rápidos.</p>';
            return;
        }
        const ul = document.createElement('ul');
        ul.className = 'list-group list-group-flush';
        for (const p of plantillas) {
            const li = document.createElement('li');
            li.className = 'list-group-item px-2 py-2 small';
            li.dataset.id = p.id;
            const montoTxt = p.monto > 0 ? `$${formatearMonto(p.monto)}` : '<em class="text-muted">sin monto fijo</em>';
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${escapeHtml(p.descripcion)}</strong>
                        <span class="text-muted"> · ${escapeHtml(p.categoria)} · ${p.tipo}</span>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="mr-2">${montoTxt}</span>
                        <button type="button" class="btn btn-sm btn-outline-danger borrar-plantilla">✕</button>
                    </div>
                </div>
            `;
            ul.appendChild(li);
        }
        plantillasLista.appendChild(ul);
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
    const data = JSON.stringify({
        version: 2,
        movimientos: finanzas.movimientos,
        presupuestos: finanzas.presupuestos,
        recurrentes: finanzas.recurrentes,
        plantillas: finanzas.plantillas
    }, null, 2);
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

            if (Array.isArray(parsed)) {
                if (!parsed.every(validarMovimiento)) throw new Error('Algún movimiento es inválido');
                const ok = confirm(`Esto reemplazará tus movimientos actuales (${finanzas.movimientos.length}) por los del archivo (${parsed.length}). ¿Continuar?`);
                if (!ok) return;
                finanzas.reemplazarTodo(parsed);
            } else {
                const nMov = Array.isArray(parsed.movimientos) ? parsed.movimientos.length : 0;
                const ok = confirm(`Esto reemplazará tus datos actuales (movimientos, topes, fijos y accesos) por los del archivo (${nMov} movimientos). ¿Continuar?`);
                if (!ok) return;
                finanzas.reemplazarBundle(parsed);
            }

            refrescarTodo();
            ui.imprimirAlerta('Datos importados');
        } catch (err) {
            console.error(err);
            ui.imprimirAlerta('Archivo JSON inválido', 'error');
        }
    };
    reader.onerror = () => ui.imprimirAlerta('No se pudo leer el archivo', 'error');
    reader.readAsText(file);
}

function refrescarTodo() {
    ui.poblarCategorias(inputCategoria, tipoSeleccionado());
    ui.poblarCategorias(recCategoria, recTipo.value);
    ui.poblarCategorias(plCategoria, plTipo.value);
    ui.renderPresupuestosInputs(finanzas.presupuestos);
    ui.renderAccesosRapidos(finanzas.plantillas);
    ui.renderRecurrentesLista(finanzas.recurrentes);
    ui.renderPlantillasLista(finanzas.plantillas);
    refrescarFiltroCategorias();
    refrescarVista();
}


function onPresupuestoInput(e) {
    const input = e.target;
    if (!input.classList.contains('presupuesto-input')) return;
    const cat = input.dataset.categoria;
    finanzas.setPresupuesto(cat, input.value);
    refrescarProgreso();
}

function agregarRecurrente(e) {
    e.preventDefault();
    const tipo = recTipo.value;
    const descripcion = recDescripcion.value.trim();
    const monto = Number(recMonto.value);
    const categoria = recCategoria.value;
    const diaDelMes = parseInt(recDia.value, 10);

    if (!descripcion) return ui.imprimirAlerta('Ponele una descripción', 'error');
    if (!monto || monto <= 0) return ui.imprimirAlerta('El monto debe ser mayor a 0', 'error');
    if (!categoria) return ui.imprimirAlerta('Elegí una categoría', 'error');
    if (!Number.isInteger(diaDelMes) || diaDelMes < 1 || diaDelMes > 31) {
        return ui.imprimirAlerta('El día debe ser entre 1 y 31', 'error');
    }

    const r = { id: nuevoId(), tipo, descripcion, monto, categoria, diaDelMes, activo: true, ultimoMesGenerado: null };
    finanzas.agregarRecurrente(r);
    const generados = finanzas.procesarRecurrentes();
    ui.renderRecurrentesLista(finanzas.recurrentes);
    refrescarFiltroCategorias();
    refrescarVista();
    recurrentesForm.reset();
    ui.poblarCategorias(recCategoria, recTipo.value);

    ui.imprimirAlerta(generados > 0 ? `Fijo agregado. Se generó el movimiento de este mes.` : 'Fijo agregado. Se va a generar solo cuando llegue el día.');
}

function onRecurrentesClick(e) {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    if (e.target.classList.contains('borrar-recurrente')) {
        if (!confirm('¿Borrar este fijo? Los movimientos ya generados se mantienen.')) return;
        finanzas.eliminarRecurrente(id);
        ui.renderRecurrentesLista(finanzas.recurrentes);
    } else if (e.target.classList.contains('toggle-recurrente')) {
        finanzas.toggleRecurrente(id);
        finanzas.procesarRecurrentes();
        ui.renderRecurrentesLista(finanzas.recurrentes);
        refrescarFiltroCategorias();
        refrescarVista();
    }
}

function agregarPlantilla(e) {
    e.preventDefault();
    const tipo = plTipo.value;
    const descripcion = plDescripcion.value.trim();
    const montoRaw = Number(plMonto.value);
    const monto = montoRaw > 0 ? montoRaw : 0;
    const categoria = plCategoria.value;

    if (!descripcion) return ui.imprimirAlerta('Ponele una descripción', 'error');
    if (!categoria) return ui.imprimirAlerta('Elegí una categoría', 'error');

    finanzas.agregarPlantilla({ id: nuevoId(), tipo, descripcion, monto, categoria });
    ui.renderPlantillasLista(finanzas.plantillas);
    ui.renderAccesosRapidos(finanzas.plantillas);
    plantillasForm.reset();
    ui.poblarCategorias(plCategoria, plTipo.value);
    ui.imprimirAlerta('Acceso rápido agregado');
}

function onPlantillasClick(e) {
    if (!e.target.classList.contains('borrar-plantilla')) return;
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    finanzas.eliminarPlantilla(li.dataset.id);
    ui.renderPlantillasLista(finanzas.plantillas);
    ui.renderAccesosRapidos(finanzas.plantillas);
}

function sincronizarTipoActivo() {
    radiosTipo.forEach(r => {
        const label = r.closest('label');
        if (!label) return;
        label.classList.toggle('active', r.checked);
    });
}

function usarPlantilla(id) {
    const p = finanzas.plantillas.find(x => x.id === id);
    if (!p) return;

    radiosTipo.forEach(r => { r.checked = r.value === p.tipo; });
    sincronizarTipoActivo();

    ui.poblarCategorias(inputCategoria, p.tipo);
    inputCategoria.value = p.categoria;
    inputDescripcion.value = p.descripcion;
    inputMonto.value = p.monto > 0 ? p.monto : '';
    inputFecha.value = fechaHoy();

    inputMonto.focus();
    inputMonto.select();
}

function onAccesoRapidoClick(e) {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    usarPlantilla(chip.dataset.id);
}

function eventListeners() {
    document.addEventListener('DOMContentLoaded', () => {
        inputFecha.value = fechaHoy();
        sincronizarTipoActivo();
        const generados = finanzas.procesarRecurrentes();
        refrescarTodo();
        if (generados > 0) {
            ui.imprimirAlerta(`Se generaron ${generados} movimiento${generados > 1 ? 's' : ''} fijo${generados > 1 ? 's' : ''} automáticamente`);
        }
    });

    presupuestosInputs.addEventListener('input', onPresupuestoInput);
    presupuestosInputs.addEventListener('change', onPresupuestoInput);

    radiosTipo.forEach(r => r.addEventListener('change', () => {
        sincronizarTipoActivo();
        ui.poblarCategorias(inputCategoria, tipoSeleccionado());
    }));
    recTipo.addEventListener('change', () => ui.poblarCategorias(recCategoria, recTipo.value));
    plTipo.addEventListener('change', () => ui.poblarCategorias(plCategoria, plTipo.value));

    formulario.addEventListener('submit', agregarMovimiento);
    listadoMovimientos.addEventListener('click', eliminarMovimiento);

    recurrentesForm.addEventListener('submit', agregarRecurrente);
    recurrentesLista.addEventListener('click', onRecurrentesClick);
    plantillasForm.addEventListener('submit', agregarPlantilla);
    plantillasLista.addEventListener('click', onPlantillasClick);
    accesosRapidos.addEventListener('click', onAccesoRapidoClick);

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
