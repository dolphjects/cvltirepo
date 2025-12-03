const params = new URLSearchParams(location.search);
const courseId = params.get('course_id');
const userRole = (params.get('role') || 'visitante').toLowerCase();
const userId = params.get('user_id');

const btnCsv = document.getElementById('btnCsv');
const tableWrap = document.getElementById('wrap');
const filtersWrap = document.getElementById('filters-wrap');
const filterName = document.getElementById('filterName');
const filterModule = document.getElementById('filterModule');

const itemDetailModal = document.getElementById('itemDetailModal');
const closeItemDetailModal = document.getElementById('closeItemDetailModal');
const detailCourseName = document.getElementById('detailCourseName');
const detailCourseCode = document.getElementById('detailCourseCode');
const detailStudentName = document.getElementById('detailStudentName');
const itemDetailTableBody = document.getElementById('itemDetailTableBody');
const closeButton = document.querySelector('.close-button');
const chartModal = document.getElementById('chartModal');

let summaryData = null;
let detailData = null;
let currentView = 'summary';
let currentSort = { column: 'sis_user_id', order: 'asc' }; 
let globalModuleNames = {}; 
let cursoInfoGlobal = {};

const translateState = (state) => {
    switch(state) {
        case 'completed': return 'Completado';
        case 'started': return 'Iniciado';
        case 'locked': return 'Bloqueado';
        case 'unlocked': return 'Desbloqueado';
        case 'N/A': return 'N/A';
        default: return state || 'N/A';
    }
};

async function load(kind) {
    if (kind === 'summary' && summaryData) return summaryData;
    if (kind === 'detail' && detailData) return detailData;
    const res = await fetch(`/report/data?course_id=${courseId}&kind=${kind}`);
    const data = await res.json();
    if (kind === 'summary') summaryData = data;
    if (kind === 'detail') detailData = data;
    return data;
}

function populateFilters(data, view) {
    const uniqueModules = [];
    const seenModules = new Set();
    data.forEach(item => {
        if (!seenModules.has(item.module_name)) {
            seenModules.add(item.module_name);
            uniqueModules.push(item.module_name);
        }
    });
    
    filterModule.innerHTML = '<option value="all">Todos los módulos</option>';
    uniqueModules.forEach(mod => filterModule.add(new Option(mod, mod)));
}

function applyFilters() {
    const nameFilter = filterName.value.toLowerCase();
    const moduleFilter = filterModule.value;
    let filteredData;

    if (currentView === 'summary') {
        if (!summaryData) return;
        filteredData = summaryData.filter(row => {
            const nameMatch = row.student_name.toLowerCase().includes(nameFilter);
            const moduleMatch = moduleFilter === 'all' || row.module_name === moduleFilter;
            return nameMatch && moduleMatch;
        });
        renderSumm(filteredData);
    } else if (currentView === 'detail') {
        if (!detailData) return;
        filteredData = detailData.filter(row => {
            const nameMatch = row.student_name.toLowerCase().includes(nameFilter);
            const moduleMatch = moduleFilter === 'all' || row.module_name === moduleFilter;
            return nameMatch && moduleMatch;
        });
        renderDetail(filteredData);
    }
}

function renderDetail(rows) {
    const t = ['<table><thead><tr><th>ID IEST</th><th>Alumno</th><th>Módulo</th><th>Item</th><th>Tipo</th><th>Req</th><th>Completado</th></tr></thead><tbody>'];
    for (const r of rows) {
        t.push(`<tr><td>${r.sis_user_id || r.student_id}</td><td>${r.student_name}</td><td>${r.module_name}</td><td>${r.item_title}</td><td>${r.item_type}</td><td>${r.requirement_type || ''}</td><td>${r.completed === true ? '✔️' : (r.completed === false ? '❌' : '')}</td></tr>`);
    }
    t.push('</tbody></table>');
    tableWrap.innerHTML = t.join('');
}

function renderSumm(rows) {
    const studentsMap = new Map();
    const modulesMap = new Map();
    const matrix = {};

    for (const row of rows) {
        if (!studentsMap.has(row.student_id)) {
            studentsMap.set(row.student_id, { 
                id: row.student_id, 
                name: row.student_name, 
                sis_user_id: row.sis_user_id || row.student_id 
            });
        }
        if (!modulesMap.has(row.module_id)) {
            const fixedName = globalModuleNames[row.module_id] || 'Módulo ?';
            modulesMap.set(row.module_id, { 
                id: row.module_id, 
                name: row.module_name, 
                short_name: fixedName 
            });
        }
        const key = `${row.student_id}_${row.module_id}`;
        matrix[key] = { pct: row.module_pct, state: row.module_state || 'N/A' };
    }

    const students = Array.from(studentsMap.values());
    const modules = Array.from(modulesMap.values());

    students.sort((a, b) => {
        const valA = a.sis_user_id || '';
        const valB = b.sis_user_id || '';
        return currentSort.order === 'asc' 
            ? valA.localeCompare(valB, undefined, { numeric: true })
            : valB.localeCompare(valA, undefined, { numeric: true });
    });

    const t = [];
    const tableId = 'avanceTable';

    t.push('<div class="table-title-container"><h2>Reporte de avance</h2></div>');
    t.push(`<table class="matrix-table" id="${tableId}">`);
    
    let sortArrow = currentSort.order === 'asc' ? '🔼' : '🔽';
    t.push('<thead><tr>');
    t.push(`<th id="sortByID" class="sortable-header" title="Ordenar por ID">ID IEST ${sortArrow}</th>`);
    t.push('<th>Nombre</th>');

    for (const m of modules) t.push(`<th title="${m.name}">${m.short_name}</th>`); 
    t.push('</tr></thead><tbody>');

    for (const s of students) {
        t.push('<tr>');
        t.push(`<td>${s.sis_user_id}</td><td>${s.name}</td>`);
        for (const m of modules) {
            const cellData = matrix[`${s.id}_${m.id}`];
            if (cellData) {
                t.push(`<td title="${translateState(cellData.state)}" 
                          class="clickable-cell" 
                          data-student-id="${s.id}" 
                          data-module-id="${m.id}"
                          data-student-name="${s.name}"
                          data-module-name="${m.name}">
                          ${cellData.pct}%
                      </td>`);
            } else {
                t.push('<td>-</td>');
            }
        }
        t.push('</tr>');
    }
    t.push('</tbody></table>');
    tableWrap.innerHTML = t.join('');

    const sortableHeader = document.getElementById('sortByID');
    if (sortableHeader) {
        sortableHeader.addEventListener('click', () => {
            currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
            applyFilters();
        });
    }

    const cells = tableWrap.querySelectorAll('.clickable-cell');
    cells.forEach(cell => {
        cell.addEventListener('click', () => {
            showItemDetail(cell.dataset.studentId, cell.dataset.moduleId, cell.dataset.studentName, cell.dataset.moduleName);
        });
    });
}

function displayUserRole() {
    const badge = document.getElementById('userRoleBadge');
    if (!badge) return;
    badge.className = 'role-badge'; 
    badge.textContent = userRole;

    if (userRole === 'profesor' || userRole === 'instructor') {
        badge.classList.add('role-profesor');
    } else if (userRole === 'estudiante' || userRole === 'learner') {
        badge.classList.add('role-estudiante');
    } else if (userRole === 'admin' || userRole === 'administrador') {
        badge.classList.add('role-admin');
    }
}

async function showItemDetail(studentId, moduleId, studentName, moduleName) {
    if (!detailData) {
        detailData = await load('detail');
    }
    const items = detailData.filter(item => item.student_id == studentId && item.module_id == moduleId);
    const requiredItems = items.filter(item => item.requirement_type !== null);
    const vistos = requiredItems.filter(item => item.completed).length;
    const pendientes = requiredItems.filter(item => !item.completed).length;
    const total = requiredItems.length;
    const pct = total > 0 ? Math.round((vistos / total) * 100) : 0;

    detailCourseName.textContent = document.getElementById('courseName').textContent;
    detailCourseCode.textContent = document.getElementById('courseCode').textContent;
    detailStudentName.textContent = studentName;

    itemDetailTableBody.innerHTML = `
        <tr><td>${moduleName}</td><td>${pct}%</td><td>${vistos}</td><td>${pendientes}</td><td>${total}</td></tr>
    `;
    document.getElementById('detail-list-container').innerHTML = '';
    itemDetailModal.classList.add('is-visible');
}

filterName.addEventListener('input', applyFilters);
filterModule.addEventListener('change', applyFilters);
btnCsv.onclick = (e) => { e.preventDefault(); window.location.href = `/report/data?course_id=${courseId}&kind=csv`; };

function closeChartModal() { if (chartModal) chartModal.style.display = "none"; }
if (closeButton) closeButton.onclick = closeChartModal;
closeItemDetailModal.onclick = () => itemDetailModal.classList.remove('is-visible');
window.addEventListener('click', (event) => {
    if (event.target == chartModal) closeChartModal();
    if (event.target == itemDetailModal) itemDetailModal.classList.remove('is-visible');
});

// --- ARRANQUE PRINCIPAL ---
(async () => {
    displayUserRole(); 
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.remove('hidden');

    try {
        // 1. Info Curso
        try {
            const cRes = await fetch(`/course-details?course_id=${courseId}`);
            cursoInfoGlobal = await cRes.json();
            document.getElementById('courseName').textContent = cursoInfoGlobal.nombre || 'Curso';
            document.getElementById('courseCode').textContent = `Código: ${cursoInfoGlobal.codigo || 'N/A'}`;
        } catch(e) { console.error(e); }

        // 2. Rol Real
        fetch(`/api/get-real-role?course_id=${courseId}&user_id=${userId}`)
            .then(r => r.json())
            .then(d => {
                if (d.role) {
                    const badge = document.getElementById('userRoleBadge');
                    if (badge) {
                        badge.textContent = d.role;
                        badge.style.backgroundColor = ''; badge.style.color = '';
                        if (d.role === 'DITE 1.0') {
                            badge.style.backgroundColor = '#6f42c1'; badge.style.color = '#fff';
                        }
                    }
                }
            })
            .catch(e => console.warn(e));

        // 3. Descargar Datos
        const res = await fetch(`/api/process-report?course_id=${courseId}`);
        if (!res.ok) throw new Error('Error cargando datos');
        
        const megaData = await res.json();
        summaryData = megaData.summary;
        detailData = megaData.detail;

        // --- COORDINADOR ---
        if (userRole === 'coordinador ac') {
             const defaultHeader = document.getElementById('default-header');
             if (defaultHeader) defaultHeader.style.display = 'none';

             document.getElementById('coordinator-view-container').style.display = 'block';
             if (filtersWrap) filtersWrap.style.display = 'none';
             if (tableWrap) tableWrap.style.display = 'none';
             if (btnCsv) btnCsv.parentElement.style.display = 'none';

             fetch(`/api/coordinator-report?course_id=${courseId}`)
                .then(r => r.json())
                .then(data => {
                    document.getElementById('coordCourseName').textContent = cursoInfoGlobal.nombre;
                    document.getElementById('coordCourseCode').textContent = cursoInfoGlobal.codigo;
                    document.getElementById('coordFormat').textContent = `Modalidad: ${cursoInfoGlobal.formato || 'N/A'}`;
                    document.getElementById('coordTeacherName').textContent = `Maestro: ${data.teacher.name}`;
                    document.getElementById('coordTotalStudents').textContent = data.total_students;

                    if (data.teacher.last_login) {
                        const date = new Date(data.teacher.last_login);
                        document.getElementById('coordLastLogin').textContent = date.toLocaleDateString('es-MX');
                    }
                    const hours = Math.floor(data.teacher.total_seconds / 3600);
                    const minutes = Math.floor((data.teacher.total_seconds % 3600) / 60);
                    document.getElementById('coordTotalTime').textContent = `${hours}h ${minutes}m`;

                    const tbody = document.getElementById('coordTableBody');
                    let html = '';

                    data.assignments.forEach(a => {
                        const percentage = a.total_students > 0 ? Math.round((a.graded / a.total_students) * 100) : 0;
                        const rowClass = percentage < 50 ? 'grading-bad' : ''; 
                        const dateStr = a.due_at ? new Date(a.due_at).toLocaleDateString('es-MX') : 'Sin fecha';
                        
                        let typeClass = 'tag-assignment';
                        if(a.type === 'Examen') typeClass = 'tag-quiz';
                        if(a.type === 'Foro') typeClass = 'tag-discussion';

                        html += `
                            <tr class="${rowClass}">
                                <td><span class="${typeClass}">${a.type}</span></td>
                                <td>${a.title}</td>
                                <td>${dateStr}</td>
                                <td>${a.graded} / ${a.total_students}</td>
                                <td>${percentage}%</td>
                            </tr>
                        `;
                    });
                    
                    if(data.assignments.length === 0) html = '<tr><td colspan="5" style="text-align:center;">No hay entregables.</td></tr>';
                    tbody.innerHTML = html;
                })
                .catch(e => console.error(e));

             if (loader) loader.classList.add('hidden');
             return; 
        }

        // --- ALUMNO ---
        if (['estudiante', 'studentenrollment', 'student', 'learner'].includes(userRole)) {
            const studentMsg = document.getElementById('student-view-container');
            if (studentMsg) studentMsg.style.display = 'block';
            if (filtersWrap) filtersWrap.style.display = 'none';
            if (tableWrap) tableWrap.style.display = 'none';
            if (btnCsv) btnCsv.parentElement.style.display = 'none';

            const myData = summaryData.filter(row => 
                String(row.student_id) === String(userId) || 
                (row.sis_user_id && String(row.sis_user_id) === String(userId))
            );

            if (myData.length > 0) {
                document.getElementById('studentNameDisplay').textContent = `Hola, ${myData[0].student_name}`;
                const tbody = document.getElementById('student-table-body');
                let htmlRows = '';
                
                myData.forEach(row => {
                    const pct = row.module_pct;
                    let colorClass = 'bar-red';
                    if (pct >= 40 && pct <= 79) colorClass = 'bar-yellow';
                    if (pct >= 80) colorClass = 'bar-green';

                    htmlRows += `
                        <tr>
                            <td><strong>${row.module_name}</strong></td>
                            <td>${pct}%</td>
                            <td><div class="progress-track"><div class="progress-fill ${colorClass}" style="width: ${pct}%;"></div></div></td>
                        </tr>
                    `;
                });
                tbody.innerHTML = htmlRows;
            } else {
                document.getElementById('student-table-body').innerHTML = '<tr><td colspan="3">No se encontraron datos.</td></tr>';
            }

            const frases = [
                "¡Feliz Domingo!", "¡Lunes de inicio!", "Martes de constancia.", 
                "Miércoles, mitad de camino.", "Jueves de esfuerzo.", 
                "¡Viernes! Cierra con broche de oro.", "Sábado de repaso."
            ];
            document.getElementById('daily-message-text').textContent = frases[new Date().getDay()];

            if (loader) loader.classList.add('hidden');
            return; 
        }

        // --- PROFESOR ---
        const uniqueModuleIds = [...new Set(summaryData.map(item => item.module_id))];
        uniqueModuleIds.forEach((id, index) => {
            globalModuleNames[id] = `Módulo ${index}`;
        });

        tableWrap.style.display = 'block';
        if (filtersWrap) filtersWrap.style.display = 'flex';
        populateFilters(summaryData, 'summary');
        renderSumm(summaryData);

        if (loader) loader.classList.add('hidden');

    } catch (e) {
        console.error(e);
        if (loader) {
            loader.innerHTML = `<h3>Error</h3><p>${e.message}</p>`;
            loader.style.color = 'red';
        }
    }
})();