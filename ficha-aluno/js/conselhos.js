// =============================================================
// conselhos.js
// Conselho de classe + geração de PDF do relatório completo
// =============================================================

import {
    collection, getDocs, query, where, doc, getDoc, setDoc, documentId
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db, estado } from './config.js';
import { el, esc, dataLocalISO } from './utils.js';
import { gerarPDFRelatorioAluno, gerarPDFFichaSimples } from './pdf.js';

// =============================================================
// BUSCAR FICHAS (CONSELHOS) DO ALUNO
// IDs no Firestore: "ALUNOID_ANO"
// =============================================================
export async function fichasDoAluno(forcarReload = false) {
    if (!forcarReload && estado.cacheFichasAluno[estado.alunoAtualId]) {
        return estado.cacheFichasAluno[estado.alunoAtualId];
    }
    const q = query(
        collection(db, "fichas"),
        where(documentId(), ">=", estado.alunoAtualId + "_"),
        where(documentId(), "<", estado.alunoAtualId + "_\uf8ff")
    );
    const snap = await getDocs(q);
    const r = {};
    snap.forEach(d => { r[d.id.split("_")[1]] = d.data(); });
    estado.cacheFichasAluno[estado.alunoAtualId] = r;
    return r;
}
window.fichasDoAluno = fichasDoAluno;

// =============================================================
// MODAL: ADICIONAR CONSELHO (escolher ano)
// =============================================================
window.abrirModalAdicionarConselho = async function() {
    if (!estado.alunoAtual || !estado.alunoAtual.dataNasc) {
        alert("Dados do aluno ainda não carregados.");
        return;
    }

    el('modalAdicionarConselho').classList.remove('hidden');
    const container = el('listaAnosDisponiveis');
    container.innerHTML = '<p style="color:var(--cor-texto-suave);">Carregando...</p>';

    try {
        const fichas = await fichasDoAluno();
        const anoNasc = new Date(estado.alunoAtual.dataNasc + 'T00:00:00').getFullYear();
        const anoAtual = new Date().getFullYear();

        const disponiveis = [];
        for (let ano = anoAtual; ano >= anoNasc; ano--) {
            const d = fichas[String(ano)];
            const jaTem = d && (
                (d.texto1 && d.texto1.trim()) ||
                (d.texto2 && d.texto2.trim()) ||
                (d.texto3 && d.texto3.trim()) ||
                d.etapa
            );
            if (!jaTem) disponiveis.push(ano);
        }

        if (disponiveis.length === 0) {
            container.innerHTML = '<p style="color:var(--cor-texto-suave);text-align:center;">Todos os anos já possuem Conselho de Classe registrado.</p>';
            return;
        }

        let html = '<label style="font-weight:600;font-size:13px;">Selecione o ano para adicionar:</label>';
        html += '<select id="anoSelecionadoConselho" style="padding:12px;border:2px solid var(--cor-borda);border-radius:8px;font-size:14px;margin-top:10px;width:100%;">';
        disponiveis.forEach(ano => {
            html += `<option value="${ano}">Ano ${ano}</option>`;
        });
        html += '</select>';
        html += '<button onclick="confirmarAdicionarConselho()" style="margin-top:15px;width:100%;padding:12px;background:var(--cor-primaria);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Adicionar Conselho</button>';
        container.innerHTML = html;
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color:var(--cor-perigo);">Erro ao carregar os anos.</p>';
    }
};

window.fecharModalAdicionarConselho = function() {
    el('modalAdicionarConselho').classList.add('hidden');
};

// =============================================================
// SALVAR CONSELHOS DA TELA
// =============================================================
export async function salvarConselhosDOM() {
    for (const bloco of document.querySelectorAll('.ano-bloco')) {
        const ano = bloco.getAttribute('data-ano');
        const etapa = bloco.getAttribute('data-etapa');
        const dados = { etapa };

        const n = etapa === "Infantil" ? 2 : 3;
        for (let i = 1; i <= n; i++) {
            const elData = el(`conselho_data${i}_${ano}`);
            if (elData) dados['data' + i] = elData.value;
            const elTexto = el(`conselho_texto${i}_${ano}`);
            if (elTexto) dados['texto' + i] = elTexto.value;
        }

        const statusRadio = document.querySelector(`input[name="statusConselho_${ano}"]:checked`);
        if (statusRadio) dados.status = statusRadio.value;

        await setDoc(doc(db, "fichas", estado.alunoAtualId + "_" + ano), dados, { merge: true });
    }
}

window.confirmarAdicionarConselho = async function() {
    const ano = el('anoSelecionadoConselho').value;
    if (!ano) return;

    try {
        await salvarConselhosDOM();
        const etapa = estado.turmaAtual.etapa === "Infantil" ? "Infantil" : "Fundamental";
        await setDoc(doc(db, "fichas", estado.alunoAtualId + "_" + ano), { etapa }, { merge: true });

        delete estado.cacheFichasAluno[estado.alunoAtualId];
        fecharModalAdicionarConselho();
        await carregarConselhosComRegistro();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// DESENHAR CONSELHOS NA TELA
// =============================================================
export async function carregarConselhosComRegistro() {
    const container = el('conselhoContainer');
    container.innerHTML = "<p style='color:var(--cor-texto-suave);'>Carregando...</p>";

    const fichas = await fichasDoAluno();
    const anos = Object.keys(fichas).sort((a, b) => b - a);

    if (anos.length === 0) {
        container.innerHTML = "<p style='color:var(--cor-texto-suave);font-size:14px;'>Nenhum Conselho de Classe registrado.</p>";
        return;
    }

    const valores = [];
    let html = "";

    for (const ano of anos) {
        const dados = fichas[ano];
        const etapa = dados.etapa || (estado.turmaAtual.etapa === "Infantil" ? "Infantil" : "Fundamental");
        const n = etapa === "Infantil" ? 2 : 3;
        const rotulo = etapa === "Infantil" ? "Semestre" : "Trimestre";
        const status = dados.status || '';

        html += `<div class="ano-bloco" data-ano="${esc(ano)}" data-etapa="${etapa}">
            <h4>Ano ${esc(ano)} <select onchange="mudarEtapaAno('${esc(ano)}', this.value)" style="font-size:12px;padding:5px;border-radius:4px;border:1px solid var(--cor-borda);">
                <option value="Infantil" ${etapa === 'Infantil' ? 'selected' : ''}>Infantil (2 Semestres)</option>
                <option value="Fundamental" ${etapa === 'Fundamental' ? 'selected' : ''}>Fundamental (3 Trimestres)</option>
            </select></h4>`;

        for (let i = 1; i <= n; i++) {
            html += `<div class="semestre-box">
                <label>${i}º ${rotulo}</label>
                <input type="date" id="conselho_data${i}_${esc(ano)}">
                <textarea id="conselho_texto${i}_${esc(ano)}" placeholder="Parecer..." oninput="autoResizeTextarea(this)"></textarea>
            </div>`;
            valores.push([
                `conselho_data${i}_${ano}`, dados['data' + i] || '',
                `conselho_texto${i}_${ano}`, dados['texto' + i] || ''
            ]);
        }

        html += `<div class="status-conselho">
            <strong style="font-size:13px;">Resultado do ano:</strong>
            <label><input type="radio" name="statusConselho_${esc(ano)}" value="Aprovado" ${status === 'Aprovado' ? 'checked' : ''}> ✅ Aprovado</label>
            <label><input type="radio" name="statusConselho_${esc(ano)}" value="Reprovado" ${status === 'Reprovado' ? 'checked' : ''}> ❌ Reprovado</label>
            <label><input type="radio" name="statusConselho_${esc(ano)}" value="Aprovado por Conselho" ${status === 'Aprovado por Conselho' ? 'checked' : ''}> ⚠️ Aprovado por Conselho</label>
        </div>`;

        html += `</div>`;
    }

    container.innerHTML = html;

    valores.forEach(([idData, vData, idTexto, vTexto]) => {
        const d = el(idData);
        if (d) d.value = vData;
        const ta = el(idTexto);
        if (ta) {
            ta.value = vTexto;
            if (typeof window.autoResizeTextarea === 'function') window.autoResizeTextarea(ta);
        }
    });
}

// =============================================================
// MUDAR ETAPA (Infantil ↔ Fundamental)
// =============================================================
window.mudarEtapaAno = async function(ano, novaEtapa) {
    try {
        await salvarConselhosDOM();
        await setDoc(doc(db, "fichas", estado.alunoAtualId + "_" + ano), { etapa: novaEtapa }, { merge: true });
        delete estado.cacheFichasAluno[estado.alunoAtualId];
        await carregarConselhosComRegistro();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// MODAL: IMPRESSÃO / PDF (escolher o que vai no relatório)
// =============================================================
window.abrirModalImpressao = async function() {
    const lista = el('listaAnosImpressao');
    lista.innerHTML = "<p>Buscando...</p>";
    const anoAtual = String(new Date().getFullYear());

    const ocorrenciasPorAno = {};
    estado.ocorrenciasAtuais.forEach(oc => {
        const ano = oc.data ? oc.data.split('-')[0] : 'Sem ano';
        if (!ocorrenciasPorAno[ano]) ocorrenciasPorAno[ano] = [];
        ocorrenciasPorAno[ano].push(oc);
    });

    const fichas = await fichasDoAluno();
    const conselhosPorAno = {};
    Object.keys(fichas).forEach(ano => {
        const d = fichas[ano];
        if ((d.texto1 && d.texto1.trim()) ||
            (d.texto2 && d.texto2.trim()) ||
            (d.texto3 && d.texto3.trim())) {
            conselhosPorAno[ano] = d;
        }
    });

    const todosAnos = Array.from(new Set([
        ...Object.keys(ocorrenciasPorAno),
        ...Object.keys(conselhosPorAno)
    ])).sort((a, b) => b - a);

    if (todosAnos.length === 0) {
        if (confirm("Este aluno não possui Conselho de Classe nem Ocorrências.\n\nDeseja gerar só a ficha básica (dados + encaminhamentos)?")) {
            await window.imprimirApenasFicha();
        }
        return;
    }

    lista.innerHTML = "";
    todosAnos.forEach(ano => {
        const grupo = document.createElement('div');
        grupo.className = 'ano-grupo';
        const temOc = !!ocorrenciasPorAno[ano];
        const temCon = !!conselhosPorAno[ano];
        const checked = (ano === anoAtual) ? 'checked' : '';

        let checkboxes = '';
        if (temCon) {
            checkboxes += `<label><input type="checkbox" class="check-item" data-tipo="conselho" data-ano="${esc(ano)}" ${checked}> 📖 Conselho de Classe</label>`;
        }
        if (temOc) {
            checkboxes += `<label><input type="checkbox" class="check-item" data-tipo="ocorrencia" data-ano="${esc(ano)}" ${checked}> 📋 Ocorrências (${ocorrenciasPorAno[ano].length})</label>`;
        }

        grupo.innerHTML = `
            <div class="ano-grupo-header" onclick="this.parentElement.classList.toggle('ano-grupo-aberto')">
                <span>📅 Ano ${esc(ano)} ${ano === anoAtual ? '(vigente)' : ''}</span>
                <span>▼</span>
            </div>
            <div class="ano-grupo-conteudo">${checkboxes}</div>
        `;
        lista.appendChild(grupo);
    });

    document.querySelectorAll('.ano-grupo').forEach(g => g.classList.add('ano-grupo-aberto'));
    el('modalImpressao').classList.remove('hidden');
};

window.marcarTudoImpressao = function(marcar) {
    document.querySelectorAll('.check-item').forEach(cb => { cb.checked = marcar; });
};

window.fecharModalImpressao = function() {
    el('modalImpressao').classList.add('hidden');
};

// =============================================================
// PDF: FICHA SIMPLES
// =============================================================
window.imprimirApenasFicha = async function() {
    await gerarPDFFichaSimples(estado.alunoAtual, estado.turmaAtual, {});
};

// =============================================================
// PDF: RELATÓRIO COMPLETO (com base nos itens marcados)
// =============================================================
window.executarImpressao = async function() {
    const selecionados = Array.from(document.querySelectorAll('.check-item:checked')).map(cb => ({
        tipo: cb.getAttribute('data-tipo'),
        ano: cb.getAttribute('data-ano')
    }));
    if (selecionados.length === 0) { alert("Selecione pelo menos uma opção."); return; }

    const fichas = await fichasDoAluno();
    const anos = Array.from(new Set(selecionados.map(s => s.ano))).sort((a, b) => b - a);

    fecharModalImpressao();

    // Gera 1 PDF por ano (mais organizado)
    for (const ano of anos) {
        const incluirConselho = selecionados.some(s => s.ano === ano && s.tipo === 'conselho');
        const incluirOcorrencias = selecionados.some(s => s.ano === ano && s.tipo === 'ocorrencia');

        await gerarPDFRelatorioAluno(estado.alunoAtual, estado.turmaAtual, {
            ano,
            fichas,
            ocorrencias: estado.ocorrenciasAtuais,
            relatorios: estado.relatoriosAtuais || [],
            incluirConselho,
            incluirOcorrencias,
            incluirRelatorios: false,
            incluirEncaminhamentos: true,
            incluirObservacoes: true,
            incluirAssinaturas: true,
            incluirFoto: false
        });
    }
};