// =============================================================
// alunos.js
// Cadastro, busca, ficha do aluno, foto, exportação PDF
// =============================================================

import {
    collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db, estado, configPdf } from './config.js';
import { el, esc, semAcento, calcularIdade, enviarImgBB } from './utils.js';
import { salvarConselhosDOM, carregarConselhosComRegistro, fichasDoAluno } from './conselhos.js';
import { carregarOcorrencias } from './ocorrencias.js';
import { carregarAnexos } from './anexos.js';
import {
    gerarPDFRelatorioAluno,
    gerarPDFLoteTurma
} from './pdf.js';

const CAMPOS_ENC = [
    'saude_psicologico', 'saude_fono', 'saude_neuro', 'saude_pediatra',
    'social_rede', 'social_busca', 'social_conselho', 'social_serp', 'social_sinan',
    'atend_cmaee_av', 'atend_cmaee_surdez', 'atend_cmaee_tea', 'atend_cmaee_joelma'
];

// Mapeia chave amigável → campo no Firestore
const MAPA_OBS = {
    saude: 'obs_enc_saude',
    atend: 'obs_enc_atend',
    social: 'obs_enc_social'
};

// =============================================================
// CACHE E BUSCA
// =============================================================
export async function carregarTodosOsAlunos() {
    const snap = await getDocs(collection(db, "alunos"));
    estado.todosOsAlunosCache = [];
    snap.forEach(d => {
        const a = d.data();
        estado.todosOsAlunosCache.push({ id: d.id, nome: a.nome || '', turmaId: a.turmaId });
    });
}
window.carregarTodosOsAlunos = carregarTodosOsAlunos;

window.buscarAluno = async function(texto) {
    const lista = el('listaSugestoes');
    if (texto.trim().length < 2) { lista.classList.add('hidden'); return; }

    if (estado.todosOsAlunosCache.length === 0) await carregarTodosOsAlunos();

    const termo = semAcento(texto.trim());
    const resultados = estado.todosOsAlunosCache
        .filter(a => semAcento(a.nome).includes(termo))
        .slice(0, 10);

    if (resultados.length === 0) {
        lista.innerHTML = '<div class="sem-resultados">Nenhum aluno encontrado.</div>';
        lista.classList.remove('hidden');
        return;
    }

    if (estado.todasAsTurmasCache.length === 0 && typeof window.carregarTurmasCache === 'function') {
        await window.carregarTurmasCache();
    }
    const turmasMap = {};
    estado.todasAsTurmasCache.forEach(t => { turmasMap[t.id] = t.nome; });

    lista.innerHTML = "";
    resultados.forEach(aluno => {
        const item = document.createElement('div');
        item.className = 'sugestao-item';
        item.innerHTML = `
            <div><strong>${esc(aluno.nome)}</strong></div>
            <div class="turma-info">Turma: ${esc(turmasMap[aluno.turmaId] || 'Sem turma')}</div>`;
        item.onclick = () => abrirFichaAlunoPorBusca(aluno.id, aluno.turmaId);
        lista.appendChild(item);
    });
    lista.classList.remove('hidden');
};

document.addEventListener('click', function(event) {
    const bc = document.querySelector('.busca-container');
    if (bc && !bc.contains(event.target)) {
        const lista = el('listaSugestoes');
        if (lista) lista.classList.add('hidden');
    }
});

// =============================================================
// ABRIR FICHA A PARTIR DA BUSCA
// =============================================================
export async function abrirFichaAlunoPorBusca(alunoId, turmaId) {
    el('campoBusca').value = "";
    el('listaSugestoes').classList.add('hidden');

    if (!turmaId) { alert("Este aluno está sem turma."); return; }

    const turmaSnap = await getDoc(doc(db, "turmas", turmaId));
    if (!turmaSnap.exists()) { alert("Turma não encontrada."); return; }

    const t = turmaSnap.data();
    estado.turmaAtual = {
        id: turmaId,
        nome: t.nome,
        professor: t.professor,
        professorApoio: t.professorApoio || '',
        pedagogo: t.pedagogo,
        turno: t.turno,
        etapa: t.etapaEnsino
    };

    el('detalheNomeTurma').innerText = estado.turmaAtual.nome;
    el('detalheProfessor').innerText = "Professor(a): " + estado.turmaAtual.professor;
    if (estado.turmaAtual.professorApoio) {
        el('detalheProfessorApoio').innerText = "Prof. Apoio: " + estado.turmaAtual.professorApoio;
        el('detalheProfessorApoio').style.display = 'block';
    } else {
        el('detalheProfessorApoio').style.display = 'none';
    }
    el('detalhePedagogo').innerText = "Pedagogo(a): " + estado.turmaAtual.pedagogo;
    el('detalheTurno').innerText = "Turno: " + estado.turmaAtual.turno;

    if (typeof window.carregarAlunosDaTurma === 'function') {
        window.carregarAlunosDaTurma(turmaId);
    }

    ['telaTurmas', 'telaTurmaDetalhe', 'telaConfig'].forEach(i => el(i).classList.add('hidden'));
    await window.abrirFichaAluno(alunoId);
}
window.abrirFichaAlunoPorBusca = abrirFichaAlunoPorBusca;

// =============================================================
// OBSERVAÇÕES COLAPSÁVEIS (Saúde / Atendimentos / Social)
// =============================================================

// Aplica o estado inicial de uma observação (fechada)
function atualizarBotaoObs(chave) {
    const campo = MAPA_OBS[chave];
    const texto = (estado.alunoAtual && estado.alunoAtual[campo]) || '';
    const btn = el('obs-toggle-' + chave);
    const resumo = el('obs-resumo-' + chave);
    const box = el('obs-box-' + chave);
    if (!btn) return;

    // Sempre fecha o box e limpa o estado aberto
    box.classList.add('hidden');
    btn.classList.remove('aberto');

    const txtBtn = btn.querySelector('.obs-toggle-texto');

    if (texto.trim()) {
        // Tem observação → mostra botão amarelo + resumo do texto
        btn.classList.add('tem-obs');
        txtBtn.textContent = '📝 Ver observação';
        resumo.textContent = texto;
        resumo.classList.remove('hidden');
    } else {
        // Sem observação → botão azul clarinho
        btn.classList.remove('tem-obs');
        txtBtn.textContent = '+ Adicionar observação';
        resumo.textContent = '';
        resumo.classList.add('hidden');
    }
}

// Abre/fecha o box de uma observação
window.toggleObs = function(chave) {
    const btn = el('obs-toggle-' + chave);
    const box = el('obs-box-' + chave);
    const resumo = el('obs-resumo-' + chave);

    const estaAberto = !box.classList.contains('hidden');

    if (estaAberto) {
        // Fecha
        box.classList.add('hidden');
        btn.classList.remove('aberto');
        // Se tem texto, mostra o resumo de volta
        const campo = MAPA_OBS[chave];
        const texto = (estado.alunoAtual && estado.alunoAtual[campo]) || '';
        if (texto.trim()) resumo.classList.remove('hidden');
    } else {
        // Abre
        box.classList.remove('hidden');
        btn.classList.add('aberto');
        resumo.classList.add('hidden');
        // Preenche a textarea com o valor atual
        const campo = MAPA_OBS[chave];
        const ta = el(campo);
        if (ta) {
            ta.value = (estado.alunoAtual && estado.alunoAtual[campo]) || '';
            ta.focus();
        }
    }
};

// Salva a observação no Firestore
window.salvarObs = async function(chave) {
    const campo = MAPA_OBS[chave];
    const ta = el(campo);
    if (!ta) return;

    const texto = ta.value.trim();

    try {
        await updateDoc(doc(db, "alunos", estado.alunoAtualId), { [campo]: texto });
        estado.alunoAtual[campo] = texto;

        // Atualiza botão e fecha o box
        atualizarBotaoObs(chave);
        alert("✅ Observação salva!");
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// Apaga a observação
window.apagarObs = async function(chave) {
    if (!confirm("Apagar a observação?")) return;
    const campo = MAPA_OBS[chave];

    try {
        await updateDoc(doc(db, "alunos", estado.alunoAtualId), { [campo]: '' });
        estado.alunoAtual[campo] = '';

        // Limpa textarea e fecha
        const ta = el(campo);
        if (ta) ta.value = '';

        atualizarBotaoObs(chave);
        alert("🗑️ Observação apagada!");
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// ABRIR FICHA DO ALUNO
// =============================================================
export function limparFormFicha() {
    CAMPOS_ENC.forEach(c => {
        el(c).value = 'Não';
        el(c + '_data').value = '';
    });

    // Psicoeducacional (não é colapsável)
    el('saude_psicoeducacional').value = 'Não';
    el('obsPsicoeducacionalWrap').classList.add('hidden');
    const taPsico = el('obs_enc_psicoeducacional');
    if (taPsico) taPsico.value = '';

    // Observações colapsáveis
    ['saude', 'atend', 'social'].forEach(chave => {
        const campo = MAPA_OBS[chave];
        const ta = el(campo);
        if (ta) ta.value = '';
        el('obs-box-' + chave).classList.add('hidden');
        el('obs-resumo-' + chave).classList.add('hidden');
        el('obs-toggle-' + chave).classList.remove('aberto', 'tem-obs');
    });

    el('observacoes').value = '';
    document.getElementsByName('estudoCaso').forEach(r => r.checked = false);
}

export async function abrirFichaAluno(alunoId) {
    const alunoSnap = await getDoc(doc(db, "alunos", alunoId));
    if (!alunoSnap.exists()) { alert("Aluno não encontrado."); return; }

    estado.alunoAtualId = alunoId;
    estado.alunoAtual = alunoSnap.data();

    el('fichaNome').innerText = estado.alunoAtual.nome;
    el('fichaCGM').innerText = estado.alunoAtual.cgm || "Não informado";
    el('fichaDataNasc').innerText = estado.alunoAtual.dataNasc ? new Date(estado.alunoAtual.dataNasc + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    el('fichaIdade').innerText = estado.alunoAtual.dataNasc ? calcularIdade(estado.alunoAtual.dataNasc) + " anos" : '—';
    el('fichaTurma').innerText = estado.turmaAtual.nome;
    el('fichaProfessor').innerText = estado.turmaAtual.professor;
    el('fichaPedagogo').innerText = estado.turmaAtual.pedagogo;
    el('fichaTurno').innerText = estado.turmaAtual.turno;
    el('fichaUnidadeOrigem').innerText = estado.alunoAtual.unidadeOrigem || "Não informada";

    el('fotoAlunoPlaceholder').innerText = "Sem foto cadastrada";
    if (estado.alunoAtual.fotoUrl) {
        el('fotoAlunoImg').src = estado.alunoAtual.fotoUrl;
        el('fotoAlunoImg').style.display = 'block';
        el('fotoAlunoPlaceholder').style.display = 'none';
    } else {
        el('fotoAlunoImg').removeAttribute('src');
        el('fotoAlunoImg').style.display = 'none';
        el('fotoAlunoPlaceholder').style.display = 'flex';
    }

    // Limpa e preenche campos de encaminhamento
    limparFormFicha();
    CAMPOS_ENC.forEach(c => {
        if (estado.alunoAtual[c]) el(c).value = estado.alunoAtual[c];
        if (estado.alunoAtual[c + '_data']) el(c + '_data').value = estado.alunoAtual[c + '_data'];
    });

    // Psicoeducacional
    if (estado.alunoAtual.saude_psicoeducacional) {
        el('saude_psicoeducacional').value = estado.alunoAtual.saude_psicoeducacional;
    }
    const taPsico = el('obs_enc_psicoeducacional');
    if (taPsico) taPsico.value = estado.alunoAtual.obs_enc_psicoeducacional || '';
    if (typeof window.toggleObsPsicoeducacional === 'function') window.toggleObsPsicoeducacional();

    // Observações colapsáveis (Saúde / Atendimentos / Social)
    ['saude', 'atend', 'social'].forEach(chave => {
        const campo = MAPA_OBS[chave];
        const ta = el(campo);
        if (ta) ta.value = estado.alunoAtual[campo] || '';
        atualizarBotaoObs(chave);
    });

    if (estado.alunoAtual.observacoes) el('observacoes').value = estado.alunoAtual.observacoes;
    if (estado.alunoAtual.estudoCaso) {
        document.getElementsByName('estudoCaso').forEach(r => {
            r.checked = (r.value === estado.alunoAtual.estudoCaso);
        });
    }

    el('telaTurmaDetalhe').classList.add('hidden');
    el('telaFichaAluno').classList.remove('hidden');
    estado.fichaTemAlteracoes = false;

    await carregarOcorrencias();
    await carregarAnexos();
    await carregarConselhosComRegistro();
}
window.abrirFichaAluno = abrirFichaAluno;

// =============================================================
// CADASTRAR NOVO ALUNO
// =============================================================
window.abrirFormAluno = function() {
    el('modalAdicionarAluno').classList.remove('hidden');
};
window.fecharModalAdicionarAluno = function() {
    el('modalAdicionarAluno').classList.add('hidden');
};

window.salvarAluno = async function() {
    const nome = el('alunoNome').value.trim();
    const dataNasc = el('alunoDataNasc').value;
    const cgm = el('alunoCGM').value.trim();
    const unidadeOrigem = el('alunoUnidadeOrigem').value.trim();

    if (!nome || !dataNasc) {
        alert("Nome e Data de Nascimento são obrigatórios.");
        return;
    }

    try {
        await addDoc(collection(db, "alunos"), {
            nome, dataNasc, cgm, unidadeOrigem,
            turmaId: estado.turmaAtual.id
        });
        alert("✅ Aluno cadastrado!");
        ['alunoNome', 'alunoDataNasc', 'alunoCGM', 'alunoUnidadeOrigem'].forEach(i => el(i).value = "");
        fecharModalAdicionarAluno();
        if (typeof window.carregarAlunosDaTurma === 'function') {
            window.carregarAlunosDaTurma(estado.turmaAtual.id);
        }
        await carregarTodosOsAlunos();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// EDITAR DADOS DO ALUNO
// =============================================================
window.abrirModalEditarAluno = function() {
    if (!estado.alunoAtual) { alert("Aluno não carregado."); return; }
    el('editAlunoNome').value = estado.alunoAtual.nome || '';
    el('editAlunoDataNasc').value = estado.alunoAtual.dataNasc || '';
    el('editAlunoCGM').value = estado.alunoAtual.cgm || '';
    el('editAlunoUnidadeOrigem').value = estado.alunoAtual.unidadeOrigem || '';
    el('modalEditarAluno').classList.remove('hidden');
};
window.fecharModalEditarAluno = function() {
    el('modalEditarAluno').classList.add('hidden');
};

window.salvarEdicaoAluno = async function() {
    const nome = el('editAlunoNome').value.trim();
    const dataNasc = el('editAlunoDataNasc').value;
    const cgm = el('editAlunoCGM').value.trim();
    const unidadeOrigem = el('editAlunoUnidadeOrigem').value.trim();

    if (!nome || !dataNasc) {
        alert("Nome e Data de Nascimento são obrigatórios.");
        return;
    }

    try {
        await updateDoc(doc(db, "alunos", estado.alunoAtualId), { nome, dataNasc, cgm, unidadeOrigem });
        Object.assign(estado.alunoAtual, { nome, dataNasc, cgm, unidadeOrigem });

        el('fichaNome').innerText = nome;
        el('fichaDataNasc').innerText = new Date(dataNasc + 'T00:00:00').toLocaleDateString('pt-BR');
        el('fichaIdade').innerText = calcularIdade(dataNasc) + " anos";
        el('fichaCGM').innerText = cgm || "Não informado";
        el('fichaUnidadeOrigem').innerText = unidadeOrigem || "Não informada";

        fecharModalEditarAluno();
        alert("✅ Dados atualizados!");
        await carregarTodosOsAlunos();
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
};

// =============================================================
// FOTO DO ALUNO
// =============================================================
window.abrirCamera = function() {
    el('inputFoto').click();
};

window.carregarFoto = async function(event) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;

    const ph = el('fotoAlunoPlaceholder');
    ph.innerText = "Enviando foto...";
    ph.style.display = 'flex';
    el('fotoAlunoImg').style.display = 'none';

    try {
        const urlFoto = await enviarImgBB(file);
        await updateDoc(doc(db, "alunos", estado.alunoAtualId), { fotoUrl: urlFoto });
        estado.alunoAtual.fotoUrl = urlFoto;

        el('fotoAlunoImg').src = urlFoto;
        el('fotoAlunoImg').style.display = 'block';
        ph.style.display = 'none';
        alert("✅ Foto salva!");
    } catch (e) {
        alert("Erro ao enviar foto: " + e.message);
        if (estado.alunoAtual.fotoUrl) {
            el('fotoAlunoImg').style.display = 'block';
            ph.style.display = 'none';
        } else {
            ph.innerText = "Sem foto cadastrada";
        }
    } finally {
        input.value = "";
    }
};

// =============================================================
// DETECÇÃO DE ALTERAÇÕES NÃO SALVAS
// =============================================================
export function marcarAlteracaoFicha() {
    estado.fichaTemAlteracoes = true;
}

export function ativarDeteccaoAlteracoes() {
    CAMPOS_ENC.forEach(c => {
        el(c).addEventListener('change', marcarAlteracaoFicha);
        el(c + '_data').addEventListener('change', marcarAlteracaoFicha);
    });
    el('saude_psicoeducacional').addEventListener('change', marcarAlteracaoFicha);
    const taPsico = el('obs_enc_psicoeducacional');
    if (taPsico) taPsico.addEventListener('input', marcarAlteracaoFicha);
    el('observacoes').addEventListener('input', marcarAlteracaoFicha);
    document.getElementsByName('estudoCaso').forEach(r => {
        r.addEventListener('change', marcarAlteracaoFicha);
    });
}

// =============================================================
// SALVAR FICHA COMPLETA
// (não mexe nas observações colapsáveis — elas têm botão próprio)
// =============================================================
window.salvarFichaAluno = async function() {
    try {
        const dados = {};
        CAMPOS_ENC.forEach(c => {
            dados[c] = el(c).value;
            dados[c + '_data'] = el(c + '_data').value;
        });

        dados.saude_psicoeducacional = el('saude_psicoeducacional').value;
        const taPsico = el('obs_enc_psicoeducacional');
        dados.obs_enc_psicoeducacional = (dados.saude_psicoeducacional === 'Sim' && taPsico)
            ? taPsico.value
            : '';

        dados.observacoes = el('observacoes').value;

        const radio = Array.from(document.getElementsByName('estudoCaso')).find(r => r.checked);
        if (radio) dados.estudoCaso = radio.value;

        await updateDoc(doc(db, "alunos", estado.alunoAtualId), dados);
        Object.assign(estado.alunoAtual, dados);

        await salvarConselhosDOM();

        delete estado.cacheFichasAluno[estado.alunoAtualId];
        estado.fichaTemAlteracoes = false;
        alert("✅ Ficha salva!");
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
};

// =============================================================
// EXPORTAR PDF — INDIVIDUAL
// =============================================================
window.abrirModalExportarPDF = async function() {
    if (!estado.alunoAtual) { alert("Nenhum aluno carregado."); return; }

    const sel = el('anoExportarPDF');
    const fichas = await fichasDoAluno();
    const anosSet = new Set();
    estado.ocorrenciasAtuais.forEach(oc => { if (oc.data) anosSet.add(oc.data.split('-')[0]); });
    Object.keys(fichas).forEach(a => anosSet.add(a));
    (estado.relatoriosAtuais || []).forEach(r => { if (r.ano) anosSet.add(String(r.ano)); });

    const anoAtual = String(new Date().getFullYear());
    anosSet.add(anoAtual);

    const listaAnos = Array.from(anosSet).sort((a, b) => b - a);
    sel.innerHTML = listaAnos.map(a =>
        `<option value="${a}" ${a === anoAtual ? 'selected' : ''}>Ano ${a}${a === anoAtual ? ' (vigente)' : ''}</option>`
    ).join('');

    el('modalExportarPDF').classList.remove('hidden');
};

window.fecharModalExportarPDF = function() {
    el('modalExportarPDF').classList.add('hidden');
};

window.executarExportarPDF = async function() {
    const ano = el('anoExportarPDF').value;
    fecharModalExportarPDF();

    const fichas = await fichasDoAluno();
    const overlay = el('overlayGerandoPDF');
    overlay.classList.remove('hidden');

    try {
        await gerarPDFRelatorioAluno(estado.alunoAtual, estado.turmaAtual, {
            ano,
            fichas,
            ocorrencias: estado.ocorrenciasAtuais,
            relatorios: estado.relatoriosAtuais || [],
            anexos: estado.anexosAtuais || [],
            config: { ...configPdf }
        });
    } catch (e) {
        alert("Erro ao gerar PDF: " + e.message);
        console.error(e);
    } finally {
        overlay.classList.add('hidden');
    }
};

// =============================================================
// EXPORTAR PDF — LOTE (TURMA)
// =============================================================
window.abrirModalExportarPDFTurma = async function() {
    if (!estado.turmaAtual) { alert("Nenhuma turma aberta."); return; }

    el('modalExportarPDFTurma').classList.remove('hidden');
    const sel = el('anoExportarPDFTurma');
    const listaId = 'listaAlunosTurmaPDF';
    const anoAtual = String(new Date().getFullYear());

    const snap = await getDocs(query(collection(db, "alunos"), where("turmaId", "==", estado.turmaAtual.id)));
    const alunos = [];
    snap.forEach(d => alunos.push({ id: d.id, ...d.data() }));
    alunos.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

    const anosSet = new Set([anoAtual]);
    for (const a of alunos) {
        (a.ocorrencias || []).forEach(oc => { if (oc.data) anosSet.add(oc.data.split('-')[0]); });
    }
    const listaAnos = Array.from(anosSet).sort((a, b) => b - a);
    sel.innerHTML = listaAnos.map(a =>
        `<option value="${a}" ${a === anoAtual ? 'selected' : ''}>Ano ${a}${a === anoAtual ? ' (vigente)' : ''}</option>`
    ).join('');

    const div = el(listaId);
    div.innerHTML = "";
    if (alunos.length === 0) {
        div.innerHTML = "<p style='color:var(--cor-texto-suave);padding:12px;'>Nenhum aluno nesta turma.</p>";
        return;
    }
    alunos.forEach(a => {
        const linha = document.createElement('label');
        linha.className = 'check-linha';
        linha.innerHTML = `<input type="checkbox" class="check-aluno-pdf" value="${esc(a.id)}" checked> ${esc(a.nome)}`;
        div.appendChild(linha);
    });
};

window.fecharModalExportarPDFTurma = function() {
    el('modalExportarPDFTurma').classList.add('hidden');
};

window.marcarTodosAlunosPDF = function(marcar) {
    document.querySelectorAll('.check-aluno-pdf').forEach(cb => { cb.checked = marcar; });
};

window.executarExportarPDFTurma = async function() {
    const ano = el('anoExportarPDFTurma').value;
    const ids = Array.from(document.querySelectorAll('.check-aluno-pdf:checked')).map(cb => cb.value);
    if (ids.length === 0) { alert("Selecione pelo menos um aluno."); return; }

    fecharModalExportarPDFTurma();

    const overlay = el('overlayGerandoPDF');
    overlay.classList.remove('hidden');

    try {
        const alunosCompletos = [];
        for (const id of ids) {
            const snap = await getDoc(doc(db, "alunos", id));
            if (!snap.exists()) continue;
            const a = { id, ...snap.data() };

            if (configPdf.relatorio_incluir_conselho) {
                try {
                    const fSnap = await getDoc(doc(db, "fichas", id + "_" + ano));
                    if (fSnap.exists()) {
                        a.__fichas = { [String(ano)]: fSnap.data() };
                    }
                } catch (e) { console.warn("Erro fichas:", e); }
            }

            alunosCompletos.push(a);
        }

        await gerarPDFLoteTurma(alunosCompletos, estado.turmaAtual, {
            ano,
            config: { ...configPdf }
        });
    } catch (e) {
        alert("Erro ao gerar PDF: " + e.message);
        console.error(e);
    } finally {
        overlay.classList.add('hidden');
    }
};