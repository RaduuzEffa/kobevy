// --- Struktura Dat (Výchozí State) ---
const DEFAULT_STATE = {
    vyzvy: [],
    personalia: [],
    zasedani: [],
    porady: [],
    programy: {}
};

let appState = JSON.parse(localStorage.getItem('pcr_registr_state')) || DEFAULT_STATE;

function saveState() {
    localStorage.setItem('pcr_registr_state', JSON.stringify(appState));
    renderAll();
}

function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `crva_zaloha_${dateStr}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedState = JSON.parse(e.target.result);
            if (importedState && typeof importedState === 'object') {
                appState = { ...DEFAULT_STATE, ...importedState };
                saveState();
                alert('ÚSPĚCH: Data byla úspěšně nahrána a uložena.');
                location.reload(); 
            }
        } catch (err) {
            alert('CHYBA: Soubor se nepodařilo přečíst. Ujistěte se, že jde o platný JSON export.');
        }
    };
    reader.readAsText(file);
}

// ==========================================
// RENDER LOGIKA
// ==========================================
let currentYearFilter = 'all';
let currentZasedaniFilter = 'all';
let currentPoradyFilter = 'all';

function renderAll() {
    updateYearFilterOptions();
    renderVyzvy();
    renderPersonalia();
    renderZasedani();
    renderPorady();
    renderDashboard();
}

function updateYearFilterOptions() {
    const yearSelect = document.getElementById('dash-year-filter');
    if (!yearSelect) return;
    
    const years = new Set();
    appState.vyzvy.forEach(v => {
        if (v.termin) years.add(v.termin.substring(0, 4));
        if (v.hodnoceni) years.add(v.hodnoceni.substring(0, 4));
    });
    
    const selected = yearSelect.value || currentYearFilter;
    yearSelect.innerHTML = '<option value="all">Všechny roky</option>';
    Array.from(years).sort().reverse().forEach(year => {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    });
    yearSelect.value = years.has(selected) ? selected : 'all';
    currentYearFilter = yearSelect.value;
}

function renderDashboard() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const aktivniVyzvy = appState.vyzvy.filter(v => {
        if (!v.termin && !v.hodnoceni) return true;
        const currentYear = now.getFullYear();
        let termYear = v.termin ? parseInt(v.termin.substring(0, 4)) : 0;
        let hodnYear = v.hodnoceni ? parseInt(v.hodnoceni.substring(0, 4)) : 0;
        return Math.max(termYear, hodnYear) >= currentYear;
    });

    const budouciZasedani = appState.zasedani.filter(z => new Date(z.datum) >= now);
    const budouciPorady = appState.porady.filter(p => new Date(p.datum) >= now);

    document.getElementById('dash-vyzvy-count').innerText = aktivniVyzvy.length;
    document.getElementById('dash-osoby-count').innerText = appState.personalia.length;
    document.getElementById('dash-zasedani-count').innerText = budouciZasedani.length + budouciPorady.length;

    // Vytvoření seznamu nadcházejících událostí (spojení zasedání a porad, seřazení podle data)
    let udalositi = [
        ...appState.zasedani.map(z => ({ ...z, typ: 'Zasedání', dateObj: new Date(z.datum) })),
        ...appState.porady.map(p => ({ ...p, nazev: 'Porada k výzkumu', typ: 'Porada', dateObj: new Date(p.datum) }))
    ];

    // Seřadit od nejbližších
    udalositi.sort((a, b) => a.dateObj - b.dateObj);
    
    // Filtrovat pouze události od dneška dál (volitelně) a vzít první 3
    const upcoming = udalositi.filter(u => u.dateObj >= new Date(new Date().setHours(0,0,0,0))).slice(0, 3);

    const container = document.getElementById('dash-upcoming');
    container.innerHTML = '';
    
    if (upcoming.length === 0) {
        container.innerHTML = '<p class="meta">Žádné nadcházející události.</p>';
        return;
    }

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    upcoming.forEach(u => {
        let titleColor = '#60a5fa'; // Modrá pro ostatní
        if (u.dateObj.getMonth() === currentMonth && u.dateObj.getFullYear() === currentYear) {
            titleColor = '#f87171'; // Červená pro akce v aktuálním měsíci
        }

        const div = document.createElement('div');
        div.className = 'list-item glass';
        div.innerHTML = `
            <div class="list-item-info">
                <h4 style="color: ${titleColor}; margin-bottom: 0.25rem;">${u.nazev} <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">(${u.typ})</span></h4>
                <p style="color: var(--text-muted); font-size: 0.85rem;">🕒 ${u.dateObj.toLocaleString('cs-CZ')} ${u.ucastnici ? `| 👥 Účast: ${u.ucastnici}` : ''}</p>
            </div>
        `;
        container.appendChild(div);
    });

    const dashVyzvyContainer = document.getElementById('dash-vyzvy-list');
    if (dashVyzvyContainer) {
        dashVyzvyContainer.innerHTML = '';
        
        const formatCurrency = (val) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);

        const currentYearString = currentYear.toString();
        // Bereme výzvy pro letošní rok - i probíhající a čekající na hodnocení
        const letosniVyzvy = appState.vyzvy.filter(v => {
            if (!v.termin && !v.hodnoceni) return true;
            let termYear = v.termin ? parseInt(v.termin.substring(0, 4)) : 0;
            let hodnYear = v.hodnoceni ? parseInt(v.hodnoceni.substring(0, 4)) : 0;
            return Math.max(termYear, hodnYear) === currentYear;
        });

        if (letosniVyzvy.length === 0) {
            dashVyzvyContainer.innerHTML = '<p class="meta" style="color: var(--text-muted); grid-column: 1 / -1;">Pro tento rok zatím nejsou zadané žádné výzvy.</p>';
        } else {
            const grouped = {};
            letosniVyzvy.forEach(v => {
                const prog = v.program || 'Nezařazené výzvy';
                if (!grouped[prog]) grouped[prog] = { total: 0, items: [] };
                grouped[prog].items.push(v);
                grouped[prog].total += (parseFloat(v.alokace) || 0);
            });

            Object.keys(grouped).sort().forEach(progName => {
                const group = grouped[progName];
                const celkovaAlokaceProgramu = (appState.programy && appState.programy[progName]) ? appState.programy[progName].celkovaAlokace : null;
                
                const headerDiv = document.createElement('div');
                headerDiv.style.gridColumn = '1 / -1';
                headerDiv.style.marginTop = '1rem';
                headerDiv.style.marginBottom = '0.5rem';
                headerDiv.style.padding = '1rem 1.5rem';
                headerDiv.style.background = 'rgba(59, 130, 246, 0.15)';
                headerDiv.style.borderRadius = '12px';
                headerDiv.style.borderLeft = '4px solid var(--accent)';
                
                headerDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <h3 style="margin:0;">📂 Program: <strong>${progName}</strong></h3>
                        <div style="text-align: right;">
                            ${celkovaAlokaceProgramu ? `
                                <div style="font-size: 0.95rem; color: var(--text-muted);">Celkový rozpočet programu: <strong style="color: white;">${formatCurrency(celkovaAlokaceProgramu)}</strong></div>
                                <div style="color: #34d399; font-size: 1.05rem; margin-top: 0.25rem;">Rozděleno ve výzvách: ${formatCurrency(group.total)}</div>
                            ` : `
                                <div style="color: #34d399; font-size: 1.1rem;">Rozděleno ve výzvách: ${formatCurrency(group.total)}</div>
                            `}
                        </div>
                    </div>
                `;
                dashVyzvyContainer.appendChild(headerDiv);

                group.items.forEach(vyzva => {
                    const div = document.createElement('div');
                    div.className = 'card glass';
                    div.innerHTML = `
                        <h3>${vyzva.nazev}</h3>
                        <p class="meta">Termín uzávěrky: ${vyzva.termin || 'Nenastaven'}</p>
                        ${vyzva.hodnoceni ? `<p class="meta" style="color: #34d399; font-weight: 600;">Termín hodnocení: ${vyzva.hodnoceni}</p>` : ''}
                        ${vyzva.alokace ? `<p class="meta" style="color: var(--text-main); margin-top: 0.25rem;">Alokace: <strong>${formatCurrency(vyzva.alokace)}</strong></p>` : ''}
                        <p style="margin-top: 0.5rem;" class="dash-vyzva-desc">${vyzva.popis}</p>
                    `;
                    dashVyzvyContainer.appendChild(div);
                });
            });
        }
    }
}

function renderVyzvy() {
    const container = document.getElementById('vyzvy-list');
    container.innerHTML = '';
    
    const filtered = currentYearFilter === 'all' 
        ? appState.vyzvy 
        : appState.vyzvy.filter(v => 
            (v.termin && v.termin.substring(0, 4) === currentYearFilter) || 
            (v.hodnoceni && v.hodnoceni.substring(0, 4) === currentYearFilter)
          );

    if (filtered.length === 0) {
        container.innerHTML = '<p class="meta">Žádné výzvy pro vybraný rok.</p>';
        return;
    }

    // Seskupení podle programu
    const grouped = {};
    filtered.forEach(v => {
        const prog = v.program || 'Nezařazené výzvy';
        if (!grouped[prog]) grouped[prog] = { total: 0, items: [] };
        grouped[prog].items.push(v);
        grouped[prog].total += (parseFloat(v.alokace) || 0);
    });

    // Formátovač měny
    const formatCurrency = (val) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);

    // Vykreslení skupin
    Object.keys(grouped).sort().forEach(progName => {
        const group = grouped[progName];
        
        // Zajištění existence appState.programy
        if (!appState.programy) appState.programy = {};
        const celkovaAlokaceProgramu = appState.programy[progName] ? appState.programy[progName].celkovaAlokace : null;
        
        // Hlavička Programu (roztáhne se přes celou šířku gridu)
        const headerDiv = document.createElement('div');
        headerDiv.style.gridColumn = '1 / -1';
        headerDiv.style.marginTop = '1rem';
        headerDiv.style.marginBottom = '0.5rem';
        headerDiv.style.padding = '1rem 1.5rem';
        headerDiv.style.background = 'rgba(59, 130, 246, 0.15)';
        headerDiv.style.borderRadius = '12px';
        headerDiv.style.borderLeft = '4px solid var(--accent)';
        
        headerDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <h3 style="margin:0;">📂 Program: <strong>${progName}</strong></h3>
                <div style="text-align: right;">
                    ${celkovaAlokaceProgramu ? `
                        <div style="font-size: 0.95rem; color: var(--text-muted);">Celkový rozpočet programu: <strong style="color: white;">${formatCurrency(celkovaAlokaceProgramu)}</strong></div>
                        <div style="color: #34d399; font-size: 1.05rem; margin-top: 0.25rem;">Rozděleno ve výzvách: ${formatCurrency(group.total)}</div>
                        <div style="font-size: 0.95rem; margin-top: 0.25rem; color: ${(celkovaAlokaceProgramu - group.total) < 0 ? 'var(--danger)' : 'var(--accent)'};">
                            Zbývá alokovat: <strong>${formatCurrency(celkovaAlokaceProgramu - group.total)}</strong>
                        </div>
                    ` : `
                        <div style="color: #34d399; font-size: 1.1rem;">Rozděleno ve výzvách: ${formatCurrency(group.total)}</div>
                    `}
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="btn" style="background: rgba(255,255,255,0.1); color: white; padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-top: 0.75rem;" onclick="nastavitAlokaciProgramu('${progName}')">
                            ${celkovaAlokaceProgramu ? 'Upravit rozpočet programu' : 'Nastavit rozpočet programu'}
                        </button>
                        <button class="btn" style="background: rgba(59, 130, 246, 0.5); color: white; padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-top: 0.75rem; border: 1px solid var(--glass-border);" onclick="exportProgramToTxt('${progName}')" title="Vyexportovat souhrn programu do TXT">
                            📄 TXT Report
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(headerDiv);

        group.items.forEach(vyzva => {
            const div = document.createElement('div');
            div.className = 'card glass';
            div.innerHTML = `
                <h3>${vyzva.nazev}</h3>
                <p class="meta">Termín uzávěrky: ${vyzva.termin || 'Nenastaven'}</p>
                ${vyzva.hodnoceni ? `<p class="meta" style="color: #34d399; font-weight: 600;">Termín hodnocení: ${vyzva.hodnoceni}</p>` : ''}
                ${vyzva.alokace ? `<p class="meta" style="color: var(--text-main); margin-top: 0.25rem;">Alokace: <strong>${formatCurrency(vyzva.alokace)}</strong></p>` : ''}
                <p style="margin-top: 0.5rem;">${vyzva.popis}</p>
                <div style="margin-top: 1rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
                    <button class="btn" style="background: rgba(255,255,255,0.1); color: white; padding: 0.25rem 0.75rem;" onclick="editVyzva('${vyzva.id}')">Upravit</button>
                    <button class="delete-btn" onclick="deleteItem('vyzvy', '${vyzva.id}')">Smazat</button>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

function renderPersonalia() {
    const container = document.getElementById('personalia-list');
    container.innerHTML = '';
    
    const renderRoleTags = (roleData) => {
        if (!roleData) return '<span style="color: var(--text-muted); font-size: 0.8rem;">Bez přiřazení</span>';
        const roles = Array.isArray(roleData) ? roleData : roleData.split(',').map(r => r.trim()).filter(r => r);
        if (roles.length === 0) return '<span style="color: var(--text-muted); font-size: 0.8rem;">Bez přiřazení</span>';
        return roles.map(r => `<span style="background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa; padding: 0.15rem 0.5rem; border-radius: 12px; font-size: 0.75rem;">${r}</span>`).join('');
    };

    appState.personalia.forEach(osoba => {
        const div = document.createElement('div');
        div.className = 'list-item glass';
        div.style.alignItems = 'flex-start';
        div.innerHTML = `
            <div class="list-item-info">
                <h4 style="display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.5rem; font-size: 1.1rem;">
                    ${osoba.jmeno} 
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">${osoba.odbor}</span>
                </h4>
                <div style="margin-bottom: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.4rem;">
                    ${renderRoleTags(osoba.role)}
                </div>
                ${osoba.telefon ? `<p style="font-size: 0.9rem; margin-bottom: 0.2rem;">📞 ${osoba.telefon}</p>` : ''}
                ${osoba.email ? `<p style="font-size: 0.9rem;">✉️ <a href="mailto:${osoba.email}" style="color: var(--accent); text-decoration: none;">${osoba.email}</a></p>` : ''}
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                <button class="btn" style="background: rgba(255,255,255,0.1); color: white; padding: 0.25rem 0.75rem;" onclick="editOsoba('${osoba.id}')">Upravit</button>
                <button class="delete-btn" onclick="deleteItem('personalia', '${osoba.id}')">Smazat</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// Globální pomocné funkce pro rozlišení členů a hostů
function getInternalNames(fullStr) {
    if (!fullStr) return '';
    const allNames = fullStr.split(',').map(s => s.trim()).filter(s => s);
    const directoryNames = appState.personalia.map(o => o.jmeno);
    return allNames.filter(n => directoryNames.includes(n)).join(', ');
}

function getExternalNames(fullStr) {
    if (!fullStr) return '';
    const allNames = fullStr.split(',').map(s => s.trim()).filter(s => s);
    const directoryNames = appState.personalia.map(o => o.jmeno);
    return allNames.filter(n => !directoryNames.includes(n)).join(', ');
}

function renderZasedani() {
    const container = document.getElementById('zasedani-list');
    container.innerHTML = '';
    
    const now = new Date();
    
    const upcoming = appState.zasedani.filter(z => new Date(z.datum) >= now).sort((a, b) => new Date(a.datum) - new Date(b.datum));
    const past = appState.zasedani.filter(z => new Date(z.datum) < now).sort((a, b) => new Date(b.datum) - new Date(a.datum));

    let sortedZasedani = [];
    if (currentZasedaniFilter === 'upcoming') {
        sortedZasedani = upcoming;
    } else if (currentZasedaniFilter === 'past') {
        sortedZasedani = past;
    } else {
        sortedZasedani = [...upcoming, ...past];
    }

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let hasVisibleItems = false;

    sortedZasedani.forEach(zasedani => {
        const d = new Date(zasedani.datum);
        const isPast = d < now;
        
        hasVisibleItems = true;

        let titleColor = '#60a5fa'; // Modrá (Ostatní budoucí)
        if (isPast) {
            titleColor = '#34d399'; // Zelená (Proběhlé)
        } else if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            titleColor = '#f87171'; // Červená (Nejbližší - tento měsíc)
        }

        const ucastniciInt = getInternalNames(zasedani.ucastnici);
        const hoste = getExternalNames(zasedani.ucastnici);
        
        const div = document.createElement('div');
        div.className = 'card glass';
        div.innerHTML = `
            <h3 style="color: ${titleColor}; margin-bottom: 0.25rem;">${zasedani.nazev}</h3>
            <p class="meta" style="color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 600;">📅 ${d.toLocaleString('cs-CZ')}</p>
            ${ucastniciInt ? `<p style="margin-top: 0.5rem; font-size: 0.9rem;"><strong>Členové týmu:</strong> ${ucastniciInt}</p>` : ''}
            ${hoste ? `<p style="margin-top: 0.25rem; font-size: 0.9rem; color: var(--text-muted);">Hosté: ${hoste}</p>` : ''}
            ${zasedani.omluveni ? `<p style="margin-top: 0.25rem; font-size: 0.9rem; color: var(--text-muted);">Omluveni: ${zasedani.omluveni}</p>` : ''}
            <div style="margin-top: 0.75rem; background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px;">
                <span style="color: var(--text-muted); font-size: 0.85rem;">Zápis / Závěry:</span><br>
                <span style="font-size: 0.9rem;">${zasedani.zapis || 'Nezadáno'}</span>
            </div>
            <div style="margin-top: 1rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
                <button class="btn" style="background: rgba(255,255,255,0.1); color: white; padding: 0.25rem 0.75rem;" onclick="editZasedani('${zasedani.id}')">Upravit</button>
                <button class="delete-btn" onclick="deleteItem('zasedani', '${zasedani.id}')">Smazat</button>
            </div>
        `;
        container.appendChild(div);
    });

    if (!hasVisibleItems) {
        container.innerHTML = '<p class="meta" style="color: var(--text-muted);">Žádná zasedání neodpovídají vybranému filtru.</p>';
    }
}

function renderPorady() {
    const container = document.getElementById('porady-list');
    container.innerHTML = '';
    
    const now = new Date();
    
    const upcoming = appState.porady.filter(p => new Date(p.datum) >= now).sort((a, b) => new Date(a.datum) - new Date(b.datum));
    const past = appState.porady.filter(p => new Date(p.datum) < now).sort((a, b) => new Date(b.datum) - new Date(a.datum));

    let sortedPorady = [];
    if (currentPoradyFilter === 'upcoming') {
        sortedPorady = upcoming;
    } else if (currentPoradyFilter === 'past') {
        sortedPorady = past;
    } else {
        sortedPorady = [...upcoming, ...past];
    }

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let hasVisibleItems = false;

    sortedPorady.forEach(porada => {
        const d = new Date(porada.datum);
        const isPast = d < now;

        hasVisibleItems = true;

        let titleColor = '#60a5fa'; // Modrá
        if (isPast) {
            titleColor = '#34d399'; // Zelená
        } else if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            titleColor = '#f87171'; // Červená
        }

        const ucastniciInt = getInternalNames(porada.ucastnici);
        const hoste = getExternalNames(porada.ucastnici);

        const div = document.createElement('div');
        div.className = 'card glass';
        div.innerHTML = `
            <h3 style="color: ${titleColor}; margin-bottom: 0.25rem;">${porada.tema}</h3>
            <p class="meta" style="color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 600;">🕒 ${d.toLocaleString('cs-CZ')}</p>
            ${ucastniciInt ? `<p style="margin-top: 0.5rem; font-size: 0.9rem;"><strong>Členové týmu:</strong> ${ucastniciInt}</p>` : ''}
            ${hoste ? `<p style="margin-top: 0.25rem; font-size: 0.9rem; color: var(--text-muted);">Hosté: ${hoste}</p>` : ''}
            ${porada.omluveni ? `<p style="margin-top: 0.25rem; font-size: 0.9rem; color: var(--text-muted);">Omluveni: ${porada.omluveni}</p>` : ''}
            <div style="margin-top: 0.75rem; background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px;">
                <span style="color: var(--text-muted); font-size: 0.85rem;">Úkoly / Výstupy:</span><br>
                <span style="font-size: 0.9rem;">${porada.ukoly || 'Nezadáno'}</span>
            </div>
            <div style="margin-top: 1rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
                <button class="btn" style="background: rgba(255,255,255,0.1); color: white; padding: 0.25rem 0.75rem;" onclick="editPorada('${porada.id}')">Upravit</button>
                <button class="delete-btn" onclick="deleteItem('porady', '${porada.id}')">Smazat</button>
            </div>
        `;
        container.appendChild(div);
    });

    if (!hasVisibleItems) {
        container.innerHTML = '<p class="meta" style="color: var(--text-muted);">Žádné porady neodpovídají vybranému filtru.</p>';
    }
}

window.deleteItem = function(collection, id) {
    if(confirm('Opravdu chcete tuto položku smazat?')) {
        appState[collection] = appState[collection].filter(item => item.id !== id);
        saveState();
    }
}

window.nastavitAlokaciProgramu = function(progName) {
    if (!appState.programy) appState.programy = {};
    const current = appState.programy[progName] ? appState.programy[progName].celkovaAlokace : '';
    const zadano = prompt(`Zadejte celkový finanční rozpočet pro program ${progName} (v Kč).\nPro smazání nechte pole prázdné.`, current);
    
    if (zadano !== null) {
        if (zadano.trim() === '') {
            delete appState.programy[progName];
        } else {
            const val = parseFloat(zadano);
            if (!isNaN(val)) {
                appState.programy[progName] = { celkovaAlokace: val };
            } else {
                alert('Zadána neplatná číselná hodnota.');
                return;
            }
        }
        saveState();
    }
}

// Exporty do TXT
function downloadTxtFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.exportProgramToTxt = function(progName) {
    const programData = appState.programy ? appState.programy[progName] : null;
    const celkovaAlokace = programData ? programData.celkovaAlokace : 0;
    
    const vyzvy = appState.vyzvy.filter(v => (v.program || 'Nezarazené výzvy') === progName);
    const totalAllocated = vyzvy.reduce((sum, v) => sum + (parseFloat(v.alokace) || 0), 0);
    
    const formatCurrency = (val) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);

    let txt = `==================================================\n`;
    txt += `SOUHRN PROGRAMU: ${progName}\n`;
    txt += `Datum reportu: ${new Date().toLocaleDateString('cs-CZ')}\n`;
    txt += `==================================================\n\n`;
    
    if (programData) {
        txt += `Celkový rozpočet programu: ${formatCurrency(celkovaAlokace)}\n`;
        txt += `Rozděleno ve výzvách:      ${formatCurrency(totalAllocated)}\n`;
        txt += `Zbývá alokovat:            ${formatCurrency(celkovaAlokace - totalAllocated)}\n\n`;
    } else {
        txt += `Rozděleno ve výzvách celkem: ${formatCurrency(totalAllocated)}\n\n`;
    }

    txt += `--- SEZNAM VÝZEV ---\n\n`;
    
    if (vyzvy.length === 0) {
        txt += `Zatím nejsou přiřazeny žádné výzvy.\n`;
    } else {
        vyzvy.forEach((v, index) => {
            txt += `${index + 1}. Název: ${v.nazev}\n`;
            txt += `   Termín uzávěrky:  ${v.termin || 'Nenastaven'}\n`;
            if (v.hodnoceni) txt += `   Termín hodnocení: ${v.hodnoceni}\n`;
            if (v.alokace)   txt += `   Alokace:          ${formatCurrency(v.alokace)}\n`;
            txt += `   Popis:\n   ${v.popis.replace(/\n/g, '\n   ')}\n\n`;
        });
    }

    const safeName = progName.replace(/[^a-z0-9áčďéěíňóřšťúůýž]/gi, '_').toLowerCase();
    downloadTxtFile(`Program_${safeName}_report.txt`, txt);
};

// ==========================================
// INICIALIZACE UI A UDÁLOSTÍ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    const modals = document.querySelectorAll('.modal');
    const closeBtns = document.querySelectorAll('.close-btn');

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.getAttribute('data-modal')).classList.remove('active');
        });
    });

    window.addEventListener('click', (e) => {
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Form Submits
    document.getElementById('form-vyzva').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const programVal = document.getElementById('vyzva-program').value;
        const nazevVal = document.getElementById('vyzva-nazev').value;
        const popisVal = document.getElementById('vyzva-popis').value;
        const terminVal = document.getElementById('vyzva-termin').value;
        const hodnoceniVal = document.getElementById('vyzva-hodnoceni').value;
        const alokaceVal = document.getElementById('vyzva-alokace').value;

        if (editingVyzvaId) {
            // Editace existující výzvy
            const index = appState.vyzvy.findIndex(v => v.id === editingVyzvaId);
            if (index !== -1) {
                appState.vyzvy[index].program = programVal;
                appState.vyzvy[index].nazev = nazevVal;
                appState.vyzvy[index].popis = popisVal;
                appState.vyzvy[index].termin = terminVal;
                appState.vyzvy[index].hodnoceni = hodnoceniVal;
                appState.vyzvy[index].alokace = alokaceVal;
            }
        } else {
            // Nová výzva
            const novaVyzva = {
                id: 'v_' + Date.now(),
                program: programVal,
                nazev: nazevVal,
                popis: popisVal,
                termin: terminVal,
                hodnoceni: hodnoceniVal,
                alokace: alokaceVal
            };
            appState.vyzvy.push(novaVyzva);
        }
        
        saveState();
        updateYearFilterOptions();
        e.target.reset();
        document.getElementById('modal-vyzva').classList.remove('active');
    });

    document.getElementById('form-osoba').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const jmenoVal = document.getElementById('osoba-jmeno').value;
        const roleVal = document.getElementById('osoba-role').value;
        const odborVal = document.getElementById('osoba-odbor').value;
        const telefonVal = document.getElementById('osoba-telefon').value;
        const emailVal = document.getElementById('osoba-email').value;

        if (editingOsobaId) {
            const index = appState.personalia.findIndex(o => o.id === editingOsobaId);
            if (index !== -1) {
                appState.personalia[index].jmeno = jmenoVal;
                appState.personalia[index].role = roleVal;
                appState.personalia[index].odbor = odborVal;
                appState.personalia[index].telefon = telefonVal;
                appState.personalia[index].email = emailVal;
            }
        } else {
            const novaOsoba = {
                id: 'p_' + Date.now(),
                jmeno: jmenoVal,
                role: roleVal,
                odbor: odborVal,
                telefon: telefonVal,
                email: emailVal
            };
            appState.personalia.push(novaOsoba);
        }
        
        saveState();
        e.target.reset();
        document.getElementById('modal-osoba').classList.remove('active');
    });

    let editingVyzvaId = null;
    let editingOsobaId = null;
    let editingZasedaniId = null;
    let editingPoradaId = null;

    function populateEventMembers(containerId, ucastniciStr, omluveniStr, prefix) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        const ucastniciArr = ucastniciStr ? ucastniciStr.split(',').map(s => s.trim()) : [];
        const omluveniArr = omluveniStr ? omluveniStr.split(',').map(s => s.trim()) : [];

        if (appState.personalia.length === 0) {
            container.innerHTML = '<span style="font-size:0.85rem; color:var(--text-muted);">Žádní členové v adresáři.</span>';
            return;
        }

        appState.personalia.forEach(o => {
            const isUcast = ucastniciArr.includes(o.jmeno);
            const isOmluven = omluveniArr.includes(o.jmeno);
            
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.paddingBottom = '0.4rem';
            div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            
            div.innerHTML = `
                <span style="font-size: 0.9rem;">${o.jmeno}</span>
                <div style="display: flex; gap: 0.5rem; font-size: 0.8rem;">
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 0.2rem;">
                        <input type="radio" name="${prefix}_status_${o.id}" value="ucast" class="${prefix}-radio" data-name="${o.jmeno}" ${isUcast ? 'checked' : ''}> Účast
                    </label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 0.2rem; color: #f87171;">
                        <input type="radio" name="${prefix}_status_${o.id}" value="omluven" class="${prefix}-radio" data-name="${o.jmeno}" ${isOmluven ? 'checked' : ''}> Omluva
                    </label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 0.2rem; color: var(--text-muted);">
                        <input type="radio" name="${prefix}_status_${o.id}" value="nic" class="${prefix}-radio" ${!isUcast && !isOmluven ? 'checked' : ''}> -
                    </label>
                </div>
            `;
            container.appendChild(div);
        });
    }

    window.editVyzva = function(id) {
        editingVyzvaId = id;
        const vyzva = appState.vyzvy.find(v => v.id === id);
        if (vyzva) {
            document.getElementById('vyzva-program').value = vyzva.program || '';
            document.getElementById('vyzva-nazev').value = vyzva.nazev;
            document.getElementById('vyzva-popis').value = vyzva.popis;
            document.getElementById('vyzva-termin').value = vyzva.termin || '';
            document.getElementById('vyzva-hodnoceni').value = vyzva.hodnoceni || '';
            document.getElementById('vyzva-alokace').value = vyzva.alokace || '';
            
            document.getElementById('modal-vyzva-title').innerText = "Upravit výzvu";
            document.getElementById('modal-vyzva-submit').innerText = "Uložit změny";
            
            document.getElementById('modal-vyzva').classList.add('active');
        }
    };

    window.editOsoba = function(id) {
        editingOsobaId = id;
        const osoba = appState.personalia.find(o => o.id === id);
        if (osoba) {
            document.getElementById('osoba-jmeno').value = osoba.jmeno;
            document.getElementById('osoba-role').value = Array.isArray(osoba.role) ? osoba.role.join(', ') : (osoba.role || '');
            document.getElementById('osoba-odbor').value = osoba.odbor;
            document.getElementById('osoba-telefon').value = osoba.telefon || '';
            document.getElementById('osoba-email').value = osoba.email || '';
            
            document.getElementById('modal-osoba-title').innerText = "Upravit člena";
            document.getElementById('modal-osoba-submit').innerText = "Uložit změny";
            
            document.getElementById('modal-osoba').classList.add('active');
        }
    };

    window.editZasedani = function(id) {
        editingZasedaniId = id;
        const z = appState.zasedani.find(item => item.id === id);
        if (z) {
            document.getElementById('zasedani-nazev').value = z.nazev;
            document.getElementById('zasedani-datum').value = z.datum;
            document.getElementById('zasedani-zapis').value = z.zapis || '';
            
            document.getElementById('zasedani-ucastnici-externi').value = getExternalNames(z.ucastnici);
            document.getElementById('zasedani-omluveni-externi').value = getExternalNames(z.omluveni);
            
            populateEventMembers('zasedani-clenove-seznam', z.ucastnici, z.omluveni, 'zas');

            document.getElementById('modal-zasedani-title').innerText = "Upravit zasedání";
            document.getElementById('modal-zasedani-submit').innerText = "Uložit změny";
            document.getElementById('modal-zasedani').classList.add('active');
        }
    };

    window.editPorada = function(id) {
        editingPoradaId = id;
        const p = appState.porady.find(item => item.id === id);
        if (p) {
            document.getElementById('porada-tema').value = p.tema;
            document.getElementById('porada-datum').value = p.datum;
            document.getElementById('porada-ukoly').value = p.ukoly || '';
            
            document.getElementById('porada-ucastnici-externi').value = getExternalNames(p.ucastnici);
            document.getElementById('porada-omluveni-externi').value = getExternalNames(p.omluveni);
            
            populateEventMembers('porada-clenove-seznam', p.ucastnici, p.omluveni, 'por');

            document.getElementById('modal-porada-title').innerText = "Upravit poradu";
            document.getElementById('modal-porada-submit').innerText = "Uložit změny";
            document.getElementById('modal-porada').classList.add('active');
        }
    };

    document.getElementById('add-vyzva-btn').addEventListener('click', () => {
        editingVyzvaId = null;
        document.getElementById('form-vyzva').reset();
        document.getElementById('modal-vyzva-title').innerText = "Nová výzva";
        document.getElementById('modal-vyzva-submit').innerText = "Uložit výzvu";
        document.getElementById('modal-vyzva').classList.add('active');
    });

    document.getElementById('add-osoba-btn').addEventListener('click', () => {
        editingOsobaId = null;
        document.getElementById('form-osoba').reset();

        document.getElementById('modal-osoba-title').innerText = "Nový člen";
        document.getElementById('modal-osoba-submit').innerText = "Uložit člena";
        document.getElementById('modal-osoba').classList.add('active');
    });

    function processEventSubmission(e, formType, editingId, collectionName, titleField1, titleField2) {
        e.preventDefault();
        
        const ucastniciArr = [];
        const omluveniArr = [];
        
        const prefix = formType === 'zasedani' ? 'zas' : 'por';
        document.querySelectorAll(`.${prefix}-radio:checked`).forEach(radio => {
            const name = radio.getAttribute('data-name');
            if (name) {
                if (radio.value === 'ucast') ucastniciArr.push(name);
                else if (radio.value === 'omluven') omluveniArr.push(name);
            }
        });

        const extUcast = document.getElementById(`${formType}-ucastnici-externi`).value;
        if (extUcast.trim()) {
            extUcast.split(',').forEach(n => ucastniciArr.push(n.trim()));
        }

        const extOmluva = document.getElementById(`${formType}-omluveni-externi`).value;
        if (extOmluva.trim()) {
            extOmluva.split(',').forEach(n => omluveniArr.push(n.trim()));
        }

        const finalUcastnici = ucastniciArr.filter(n => n).join(', ');
        const finalOmluveni = omluveniArr.filter(n => n).join(', ');
        
        const val1 = document.getElementById(`${formType}-${titleField1}`).value;
        const val2 = document.getElementById(`${formType}-datum`).value;
        const val3 = document.getElementById(`${formType}-${titleField2}`).value;

        if (editingId) {
            const index = appState[collectionName].findIndex(item => item.id === editingId);
            if (index !== -1) {
                appState[collectionName][index][titleField1] = val1;
                appState[collectionName][index].datum = val2;
                appState[collectionName][index][titleField2] = val3;
                appState[collectionName][index].ucastnici = finalUcastnici;
                appState[collectionName][index].omluveni = finalOmluveni;
            }
        } else {
            const newItem = {
                id: (formType === 'zasedani' ? 'z_' : 'pr_') + Date.now(),
                [titleField1]: val1,
                datum: val2,
                [titleField2]: val3,
                ucastnici: finalUcastnici,
                omluveni: finalOmluveni
            };
            appState[collectionName].push(newItem);
        }
        
        saveState();
        e.target.reset();
        document.getElementById(`modal-${formType}`).classList.remove('active');
    }

    document.getElementById('form-zasedani').addEventListener('submit', (e) => {
        processEventSubmission(e, 'zasedani', editingZasedaniId, 'zasedani', 'nazev', 'zapis');
    });

    document.getElementById('form-porada').addEventListener('submit', (e) => {
        processEventSubmission(e, 'porada', editingPoradaId, 'porady', 'tema', 'ukoly');
    });

    document.getElementById('add-zasedani-btn').addEventListener('click', () => {
        editingZasedaniId = null;
        document.getElementById('form-zasedani').reset();
        document.getElementById('zasedani-ucastnici-externi').value = '';
        document.getElementById('zasedani-omluveni-externi').value = '';
        populateEventMembers('zasedani-clenove-seznam', '', '', 'zas');

        document.getElementById('modal-zasedani-title').innerText = "Nové zasedání";
        document.getElementById('modal-zasedani-submit').innerText = "Uložit zasedání";
        document.getElementById('modal-zasedani').classList.add('active');
    });

    document.getElementById('add-porada-btn').addEventListener('click', () => {
        editingPoradaId = null;
        document.getElementById('form-porada').reset();
        document.getElementById('porada-ucastnici-externi').value = '';
        document.getElementById('porada-omluveni-externi').value = '';
        populateEventMembers('porada-clenove-seznam', '', '', 'por');

        document.getElementById('modal-porada-title').innerText = "Nová porada";
        document.getElementById('modal-porada-submit').innerText = "Uložit poradu";
        document.getElementById('modal-porada').classList.add('active');
    });



    document.getElementById('copy-emails-btn').addEventListener('click', () => {
        const membersWithEmail = appState.personalia.filter(o => o.email && o.email.trim() !== '');
        
        if (membersWithEmail.length === 0) {
            alert('V databázi nejsou zatím uloženy žádné e-mailové adresy členů.');
            return;
        }

        const container = document.getElementById('email-checkbox-list');
        container.innerHTML = '';
        
        membersWithEmail.forEach(o => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '0.5rem';
            label.style.cursor = 'pointer';
            label.style.padding = '0.35rem 0';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'email-recipient-cb';
            cb.value = o.email.trim();
            cb.checked = true; // Všichni jsou předvybraní
            
            label.appendChild(cb);
            label.appendChild(document.createTextNode(`${o.jmeno} (${o.email})`));
            container.appendChild(label);
        });

        document.getElementById('modal-emaily').classList.add('active');
    });

    document.getElementById('emaily-select-all').addEventListener('click', () => {
        document.querySelectorAll('.email-recipient-cb').forEach(cb => cb.checked = true);
    });
    
    document.getElementById('emaily-deselect-all').addEventListener('click', () => {
        document.querySelectorAll('.email-recipient-cb').forEach(cb => cb.checked = false);
    });

    document.getElementById('confirm-copy-emails-btn').addEventListener('click', () => {
        const selectedEmails = [];
        document.querySelectorAll('.email-recipient-cb:checked').forEach(cb => {
            selectedEmails.push(cb.value);
        });

        if (selectedEmails.length === 0) {
            alert('Nebyly vybrány žádné adresy ke zkopírování.');
            return;
        }

        const emailString = selectedEmails.join('; ');
        
        navigator.clipboard.writeText(emailString).then(() => {
            alert('ÚSPĚCH! Bylo zkopírováno ' + selectedEmails.length + ' adres:\n\n' + emailString);
            document.getElementById('modal-emaily').classList.remove('active');
        }).catch(err => {
            const copyPrompt = prompt('Váš prohlížeč blokuje přímé zkopírování. Zkopírujte si adresy ručně z tohoto pole:', emailString);
            if (copyPrompt !== null) {
                document.getElementById('modal-emaily').classList.remove('active');
            }
        });
    });

    // Year filter listen
    const dashYearFilter = document.getElementById('dash-year-filter');
    if(dashYearFilter) {
        dashYearFilter.addEventListener('change', (e) => {
            currentYearFilter = e.target.value;
            renderVyzvy();
        });
    }

    const zasedaniFilterBtn = document.getElementById('zasedani-filter');
    if(zasedaniFilterBtn) {
        zasedaniFilterBtn.addEventListener('change', (e) => {
            currentZasedaniFilter = e.target.value;
            renderZasedani();
        });
    }

    const poradyFilterBtn = document.getElementById('porady-filter');
    if(poradyFilterBtn) {
        poradyFilterBtn.addEventListener('change', (e) => {
            currentPoradyFilter = e.target.value;
            renderPorady();
        });
    }

    // Import/Export
    document.getElementById('export-btn').addEventListener('click', exportData);
    const importInput = document.getElementById('import-file');
    document.getElementById('import-btn').addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            if (confirm('Opravdu chcete přepsat aktuální data novými daty ze zálohy?')) {
                importData(e.target.files[0]);
            }
            importInput.value = ''; 
        }
    });

    // Initial render
    renderAll();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW chyba:', err));
        });
    }
});
