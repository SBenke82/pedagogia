// =============================================================
// ocorrencias.js
// Ocorrências (acordeão por ano), convocação, comparecimento, PDF
// =============================================================

import {
    doc, getDoc, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db, estado, configPdf } from './config.js';
import { el, esc, dataLocalISO, dataBR } from './utils.js';
import { gerarPDFConvocacao, gerarPDFOcorrencias } from './pdf.js';

// =============================================================
// MODAL: NOVA OCORRÊNCIA
// =============================================================
window.abrirModalOcorrencia = function() {
    el('dataOcorrencia').value = dataLocalISO();
    el('textoOcorrencia').value = "";
    el('modalOcorrencia').classList.remove('hidden');
};
window.fecharModalOcorrencia = function() {
    el('modalOcorrencia').classList.add('hidden');
};

window.salvarOcorrencia = async function() {
    const texto = el('textoOcorrencia').value.trim();
    const data = el('dataOcorrencia').value || dataLocalISO();
    if (!texto) { alert("Digite a ocorrência."); return; }

    const ocorrencia = {
        id: 'oc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        data,
        dataFormatada: dataBR(data),
        texto,
        comunicado: null,
        compareceu: null
    };

    try {
        await updateDoc(doc(db, "alunos", estado.alunoAtualId), {
            ocorrencias: arrayUnion(ocorrencia)
        });
        fecharModalOcorrencia();
        await carregarOcorrencias();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// LISTAR OCORRÊNCIAS (acordeão por ano)
// =============================================================
export async function carregarOcorrencias() {
    const alunoSnap = await getDoc(doc(db, "alunos", estado.alunoAtualId));
    const ocorrencias = (alunoSnap.data().ocorrencias || []).slice();
    ocorrencias.sort((a, b) => String(b.data).localeCompare(String(a.data)));
    estado.ocorrenciasAtuais = ocorrencias;

    const lista = el('listaOcorrencias');
    lista.innerHTML = "";

    if (ocorrencias.length === 0) {
        lista.innerHTML = "<p style='color:var(--cor-texto-suave);font-size:14px;'>Nenhuma ocorrência registrada.</p>";
        return;
    }

    // Agrupa por ano
    const porAno = {};
    ocorrencias.forEach(oc => {
        const ano = oc.data ? oc.data.split('-')[0] : 'Sem ano';
        if (!porAno[ano]) porAno[ano] = [];
        porAno[ano].push(oc);
    });

    const anos = Object.keys(porAno).sort((a, b) => b.localeCompare(a));
    const anoAtual = String(new Date().getFullYear());

    anos.forEach(ano => {
        const ocs = porAno[ano];
        const aberto = (ano === anoAtual) ? ' aberto' : '';
        const itemAno = document.createElement('div');
        itemAno.className = 'ocorrencia-ano' + aberto;
        itemAno.innerHTML = `
            <div class="ocorrencia-ano-header" onclick="this.parentElement.classList.toggle('aberto')">
                <span>📅 Ano ${esc(ano)} (${ocs.length} ocorrência${ocs.length > 1 ? 's' : ''})</span>
                <span class="ocorrencia-ano-seta">▼</span>
            </div>
            <div class="ocorrencia-ano-conteudo"></div>
        `;

        const conteudo = itemAno.querySelector('.ocorrencia-ano-conteudo');

        ocs.forEach(oc => {
            const div = document.createElement('div');
            div.className = 'ocorrencia-item';

            let html = `<div class="data">📅 ${esc(oc.dataFormatada)}</div>`;
            html += `<div class="texto">${esc(oc.texto)}</div>`;
            html += '<div class="ocorrencia-comunicacao">';

            if (oc.comunicado) {
                html += `<div class="comunicado-info">📢 Comunicado em ${esc(oc.comunicado.dataFormatada)} às ${esc(oc.comunicado.hora)}`;
                html += ` <button onclick="event.stopPropagation();imprimirConvocacao('${esc(oc.id)}')" title="Gerar PDF da convocação">📄</button>`;
                html += ` <button onclick="event.stopPropagation();abrirModalComunicar('${esc(oc.id)}')" title="Alterar data/hora">✏️</button>`;
                html += `</div>`;

                if (oc.compareceu && oc.compareceu.data) {
                    html += `<div class="compareceu-box" style="background:#d1fae5;color:#065f46;">✅ Compareceu em ${esc(oc.compareceu.dataFormatada)} <button class="btn-mini vermelho" onclick="event.stopPropagation();desmarcarCompareceu('${esc(oc.id)}')">Remover</button></div>`;
                } else {
                    html += `<div class="compareceu-box">☐ Compareceu <input type="date" id="compareceu_data_${esc(oc.id)}"> <button class="btn-mini verde" onclick="event.stopPropagation();marcarCompareceu('${esc(oc.id)}')">Salvar</button></div>`;
                }
            } else {
                html += `<button class="btn-comunicar" onclick="event.stopPropagation();abrirModalComunicar('${esc(oc.id)}')">📢 Comunicar</button>`;
            }

            html += '</div>';
            div.innerHTML = html;
            conteudo.appendChild(div);
        });

        lista.appendChild(itemAno);
    });
}

// =============================================================
// COMUNICAR
// =============================================================
window.abrirModalComunicar = function(ocId) {
    const oc = estado.ocorrenciasAtuais.find(o => o.id === ocId);
    if (!oc) { alert("Ocorrência não encontrada."); return; }

    estado.ocIdComunicar = ocId;

    if (oc.comunicado) {
        el('comunicarData').value = oc.comunicado.data || dataLocalISO();
        el('comunicarHora').value = oc.comunicado.hora || '08:00';
    } else {
        el('comunicarData').value = dataLocalISO();
        const now = new Date();
        el('comunicarHora').value = String(now.getHours()).padStart(2, '0') + ':' +
                                    String(now.getMinutes()).padStart(2, '0');
    }
    el('modalComunicar').classList.remove('hidden');
};

window.fecharModalComunicar = function() {
    el('modalComunicar').classList.add('hidden');
    estado.ocIdComunicar = null;
};

window.salvarComunicado = async function() {
    const ocId = estado.ocIdComunicar;
    if (!ocId) return;

    const data = el('comunicarData').value;
    const hora = el('comunicarHora').value;
    if (!data || !hora) { alert("Escolha data e horário."); return; }

    const comunicado = {
        data,
        hora,
        dataFormatada: dataBR(data),
        registradoEm: new Date().toISOString()
    };

    try {
        const alunoSnap = await getDoc(doc(db, "alunos", estado.alunoAtualId));
        let ocorrencias = alunoSnap.data().ocorrencias || [];
        ocorrencias = ocorrencias.map(oc => oc.id === ocId ? { ...oc, comunicado } : oc);

        await updateDoc(doc(db, "alunos", estado.alunoAtualId), { ocorrencias });
        fecharModalComunicar();
        await carregarOcorrencias();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// COMPARECIMENTO
// =============================================================
window.marcarCompareceu = async function(ocId) {
    const inputData = el(`compareceu_data_${ocId}`);
    const data = inputData.value;
    if (!data) { alert("Escolha a data do comparecimento."); return; }

    const compareceu = { data, dataFormatada: dataBR(data) };

    try {
        const alunoSnap = await getDoc(doc(db, "alunos", estado.alunoAtualId));
        let ocorrencias = alunoSnap.data().ocorrencias || [];
        ocorrencias = ocorrencias.map(oc => oc.id === ocId ? { ...oc, compareceu } : oc);

        await updateDoc(doc(db, "alunos", estado.alunoAtualId), { ocorrencias });
        await carregarOcorrencias();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

window.desmarcarCompareceu = async function(ocId) {
    if (!confirm("Remover a marcação de comparecimento?")) return;

    try {
        const alunoSnap = await getDoc(doc(db, "alunos", estado.alunoAtualId));
        let ocorrencias = alunoSnap.data().ocorrencias || [];
        ocorrencias = ocorrencias.map(oc => oc.id === ocId ? { ...oc, compareceu: null } : oc);

        await updateDoc(doc(db, "alunos", estado.alunoAtualId), { ocorrencias });
        await carregarOcorrencias();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// PDF: CONVOCAÇÃO
// =============================================================
window.imprimirConvocacao = async function(ocId) {
    const oc = estado.ocorrenciasAtuais.find(o => o.id === ocId);
    if (!oc || !oc.comunicado) { alert("Nenhuma convocação registrada."); return; }
    await gerarPDFConvocacao(estado.alunoAtual, estado.turmaAtual, oc);
};

// =============================================================
// MODAL: SELECIONAR OCORRÊNCIAS PARA GERAR PDF
// =============================================================
window.abrirModalImprimirOcorrencias = function() {
    const lista = el('listaOcorrenciasImpressao');
    lista.innerHTML = "";

    if (estado.ocorrenciasAtuais.length === 0) {
        lista.innerHTML = "<p style='color:var(--cor-texto-suave);'>Nenhuma ocorrência registrada.</p>";
        el('modalImprimirOcorrencias').classList.remove('hidden');
        return;
    }

    const porAno = {};
    estado.ocorrenciasAtuais.forEach(oc => {
        const ano = oc.data ? oc.data.split('-')[0] : 'Sem ano';
        if (!porAno[ano]) porAno[ano] = [];
        porAno[ano].push(oc);
    });

    const anos = Object.keys(porAno).sort((a, b) => b - a);
    anos.forEach(ano => {
        const grupo = document.createElement('div');
        grupo.className = 'ano-grupo';
        grupo.innerHTML = `
            <div class="ano-grupo-header" onclick="this.parentElement.classList.toggle('ano-grupo-aberto')">
                <span>📅 Ano ${esc(ano)} (${porAno[ano].length})</span>
                <span>▼</span>
            </div>
            <div class="ano-grupo-conteudo">
                ${porAno[ano].map(oc => `
                    <label>
                        <input type="checkbox" class="check-oc-impressao" value="${esc(oc.id)}" checked>
                        <span>${esc(oc.dataFormatada)} — ${esc(oc.texto.substring(0, 60))}${oc.texto.length > 60 ? '...' : ''}</span>
                    </label>
                `).join('')}
            </div>
        `;
        lista.appendChild(grupo);
    });

    document.querySelectorAll('.ano-grupo').forEach(g => g.classList.add('ano-grupo-aberto'));
    el('modalImprimirOcorrencias').classList.remove('hidden');
};

window.fecharModalImprimirOcorrencias = function() {
    el('modalImprimirOcorrencias').classList.add('hidden');
};

window.selecionarTodasOcorrencias = function(marcar) {
    document.querySelectorAll('.check-oc-impressao').forEach(cb => { cb.checked = marcar; });
};

// =============================================================
// PDF: RELATÓRIO DE OCORRÊNCIAS (usa configPdf.ocorrencias_*)
// =============================================================
window.executarImpressaoOcorrencias = async function() {
    const selecionadas = Array.from(document.querySelectorAll('.check-oc-impressao:checked')).map(cb => cb.value);
    if (selecionadas.length === 0) { alert("Selecione pelo menos uma ocorrência."); return; }

    const lista = estado.ocorrenciasAtuais.filter(oc => selecionadas.includes(oc.id));

    // Descobre os anos das ocorrências selecionadas
    const anos = Array.from(new Set(
        lista.map(oc => oc.data ? oc.data.split('-')[0] : '').filter(Boolean)
    ));

    fecharModalImprimirOcorrencias();

    // Mostra overlay
    const overlay = el('overlayGerandoPDF');
    if (overlay) overlay.classList.remove('hidden');

    try {
        for (const ano of anos) {
            const listaAno = lista.filter(oc => oc.data && oc.data.split('-')[0] === ano);
            await gerarPDFOcorrencias(estado.alunoAtual, estado.turmaAtual, listaAno, ano, {
                config: { ...configPdf },
                anexos: estado.anexosAtuais || []
            });
        }
    } catch (e) {
        alert("Erro ao gerar PDF: " + e.message);
        console.error(e);
    } finally {
        if (overlay) overlay.classList.add('hidden');
    }
};