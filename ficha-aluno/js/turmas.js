// =============================================================
// turmas.js
// CRUD de turmas, listagem de alunos, ordenação, remanejamento
// =============================================================

import {
    collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db, estado } from './config.js';
import { el, esc } from './utils.js';

// =============================================================
// ORDENAÇÃO DE TURMAS
// =============================================================
export function getOrdemTurmas() {
    return localStorage.getItem('ordemTurmas') || 'etapa';
}

window.mudarOrdemTurmas = function(novaOrdem) {
    localStorage.setItem('ordemTurmas', novaOrdem);
    carregarTurmas();
};

// =============================================================
// UTILITÁRIOS
// =============================================================
function preencherCabecalhoTurma() {
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
}

// =============================================================
// CRIAR NOVA TURMA
// =============================================================
window.salvarTurma = async function() {
    const nome = el('nomeTurma').value.trim();
    const turno = el('turnoTurma').value;
    const professor = el('professorTurma').value.trim();
    const professorApoio = el('professorApoioTurma').value.trim();
    const pedagogo = el('pedagogoTurma').value.trim();
    const etapa = el('etapaEnsino').value;

    if (!nome || !professor || !pedagogo) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    try {
        await addDoc(collection(db, "turmas"), {
            nome, turno, professor, professorApoio, pedagogo, etapaEnsino: etapa
        });
        alert("✅ Turma salva!");
        el('nomeTurma').value = "";
        el('professorTurma').value = "";
        el('professorApoioTurma').value = "";
        el('pedagogoTurma').value = "";

        estado.telaAntesConfig = 'telaTurmas';
        if (typeof window.alternarConfiguracoes === 'function') {
            window.alternarConfiguracoes();
        }
        await carregarTurmasCache();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// LISTAR TURMAS (com ordenação)
// =============================================================
export async function carregarTurmas() {
    const grid = el('gridTurmas');
    grid.innerHTML = "";

    // Marca o select com a ordem atual
    const selOrdem = el('ordemTurmas');
    if (selOrdem) selOrdem.value = getOrdemTurmas();

    const snap = await getDocs(collection(db, "turmas"));
    if (snap.empty) {
        grid.innerHTML = "<p style='padding:20px;color:var(--cor-texto-suave);'>Nenhuma turma cadastrada.</p>";
        return;
    }

    // Conta alunos por turma
    const alunosSnap = await getDocs(collection(db, "alunos"));
    const contagem = {};
    alunosSnap.forEach(d => {
        const t = d.data().turmaId;
        if (t) contagem[t] = (contagem[t] || 0) + 1;
    });

    // Monta array
    const turmas = [];
    snap.forEach(docSnap => {
        turmas.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Ordena
    const ordem = getOrdemTurmas();
    turmas.sort((a, b) => {
        if (ordem === 'etapa') {
            const etapaA = (a.etapaEnsino || '').toLowerCase().includes('infantil') ? 0 : 1;
            const etapaB = (b.etapaEnsino || '').toLowerCase().includes('infantil') ? 0 : 1;
            if (etapaA !== etapaB) return etapaA - etapaB;
            return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        }
        if (ordem === 'nome_az') return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        if (ordem === 'nome_za') return (b.nome || '').localeCompare(a.nome || '', 'pt-BR');
        if (ordem === 'turno') {
            const t = (a.turno || '').localeCompare(b.turno || '', 'pt-BR');
            if (t !== 0) return t;
            return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        }
        if (ordem === 'alunos') {
            const qtdA = contagem[a.id] || 0;
            const qtdB = contagem[b.id] || 0;
            if (qtdB !== qtdA) return qtdB - qtdA;
            return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        }
        return 0;
    });

    // Desenha
    turmas.forEach(turma => {
        const card = document.createElement('div');
        card.className = 'card-turma';
        card.onclick = () => abrirTurma(
            turma.id,
            turma.nome,
            turma.professor,
            turma.professorApoio || '',
            turma.pedagogo,
            turma.turno,
            turma.etapaEnsino
        );
        card.innerHTML = `
            <h2>${esc(turma.nome)}</h2>
            <p><strong>👥 Alunos:</strong> ${contagem[turma.id] || 0} matriculado(s)</p>
            <p><strong>Turno:</strong> ${esc(turma.turno)}</p>
            <p><strong>Professor:</strong> ${esc(turma.professor)}</p>
            ${turma.professorApoio ? `<p><strong>Prof. Apoio:</strong> ${esc(turma.professorApoio)}</p>` : ''}
            <p><strong>Pedagogo:</strong> ${esc(turma.pedagogo)}</p>
            <p><strong>Etapa:</strong> ${esc(turma.etapaEnsino)}</p>`;
        grid.appendChild(card);
    });
}

// =============================================================
// ABRIR UMA TURMA
// =============================================================
export async function abrirTurma(id, nome, professor, professorApoio, pedagogo, turno, etapa) {
    estado.turmaAtual = { id, nome, professor, professorApoio: professorApoio || '', pedagogo, turno, etapa };

    el('telaTurmas').classList.add('hidden');
    el('telaTurmaDetalhe').classList.remove('hidden');
    el('telaFichaAluno').classList.add('hidden');
    el('telaConfig').classList.add('hidden');

    preencherCabecalhoTurma();
    await carregarAlunosDaTurma(id);
}
window.abrirTurma = abrirTurma;

// =============================================================
// LISTAR ALUNOS DA TURMA
// =============================================================
export async function carregarAlunosDaTurma(turmaId) {
    const lista = el('listaAlunos');
    lista.innerHTML = "<p style='padding:20px;color:var(--cor-texto-suave);'>Carregando alunos...</p>";

    const snap = await getDocs(query(collection(db, "alunos"), where("turmaId", "==", turmaId)));
    lista.innerHTML = "";

    if (snap.empty) {
        lista.innerHTML = "<p style='padding:20px;color:var(--cor-texto-suave);'>Nenhum aluno cadastrado nesta turma.</p>";
        return;
    }

    const alunos = [];
    snap.forEach(d => alunos.push({ id: d.id, nome: d.data().nome || '' }));
    alunos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    alunos.forEach(a => {
        const item = document.createElement('div');
        item.className = 'aluno-item';
        const span = document.createElement('span');
        span.className = 'nome-aluno';
        span.textContent = a.nome;
        span.onclick = () => window.abrirFichaAluno(a.id);
        item.appendChild(span);
        lista.appendChild(item);
    });
}
window.carregarAlunosDaTurma = carregarAlunosDaTurma;

// =============================================================
// CACHE DE TURMAS
// =============================================================
export async function carregarTurmasCache() {
    const snap = await getDocs(collection(db, "turmas"));
    estado.todasAsTurmasCache = [];
    snap.forEach(d => estado.todasAsTurmasCache.push({ id: d.id, ...d.data() }));
}
window.carregarTurmasCache = carregarTurmasCache;

// =============================================================
// ENGRENAGEM DA TURMA
// =============================================================
window.abrirEngrenagemTurma = function() {
    el('modalEngrenagemTurma').classList.remove('hidden');
};
window.fecharModalEngrenagem = function() {
    el('modalEngrenagemTurma').classList.add('hidden');
};

// =============================================================
// EDITAR TURMA
// =============================================================
window.abrirModalEditarTurma = function() {
    if (!estado.turmaAtual) { alert("Turma não carregada."); return; }
    el('editTurmaNome').value = estado.turmaAtual.nome || '';
    el('editTurmaTurno').value = estado.turmaAtual.turno || 'Manhã';
    el('editTurmaProfessor').value = estado.turmaAtual.professor || '';
    el('editTurmaProfessorApoio').value = estado.turmaAtual.professorApoio || '';
    el('editTurmaPedagogo').value = estado.turmaAtual.pedagogo || '';
    el('editTurmaEtapa').value = estado.turmaAtual.etapa || 'Infantil';
    el('modalEditarTurma').classList.remove('hidden');
};
window.fecharModalEditarTurma = function() {
    el('modalEditarTurma').classList.add('hidden');
};

window.salvarEdicaoTurma = async function() {
    const nome = el('editTurmaNome').value.trim();
    const turno = el('editTurmaTurno').value;
    const professor = el('editTurmaProfessor').value.trim();
    const professorApoio = el('editTurmaProfessorApoio').value.trim();
    const pedagogo = el('editTurmaPedagogo').value.trim();
    const etapa = el('editTurmaEtapa').value;

    if (!nome || !professor || !pedagogo) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    try {
        await updateDoc(doc(db, "turmas", estado.turmaAtual.id), {
            nome, turno, professor, professorApoio, pedagogo, etapaEnsino: etapa
        });
        Object.assign(estado.turmaAtual, { nome, turno, professor, professorApoio, pedagogo, etapa });
        preencherCabecalhoTurma();
        fecharModalEditarTurma();
        alert("✅ Turma atualizada!");
        await carregarTurmasCache();
        await carregarTurmas();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// DELETAR TURMA
// =============================================================
window.deletarTurma = async function() {
    const alunosSnap = await getDocs(query(collection(db, "alunos"), where("turmaId", "==", estado.turmaAtual.id)));
    if (alunosSnap.size > 0) {
        alert(`Esta turma possui ${alunosSnap.size} aluno(s). Remaneje antes de deletar.`);
        return;
    }
    if (!confirm(`⚠️ Deletar a turma "${estado.turmaAtual.nome}"?`)) return;

    try {
        await deleteDoc(doc(db, "turmas", estado.turmaAtual.id));
        alert("✅ Turma deletada!");
        await carregarTurmasCache();
        voltarParaTurmas();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// REMANEJAR ALUNOS
// =============================================================
window.abrirModalRemanejar = async function() {
    el('modalRemanejar').classList.remove('hidden');
    const conteudo = el('conteudoRemanejar');
    conteudo.innerHTML = '<p>Carregando alunos...</p>';

    await carregarTurmasCache();
    const snap = await getDocs(query(collection(db, "alunos"), where("turmaId", "==", estado.turmaAtual.id)));

    if (snap.empty) {
        conteudo.innerHTML = '<p style="color:var(--cor-texto-suave);">Nenhum aluno nesta turma.</p>';
        return;
    }

    let options = '<option value="">— Não mover —</option>';
    estado.todasAsTurmasCache.forEach(t => {
        if (t.id !== estado.turmaAtual.id) {
            options += `<option value="${esc(t.id)}">${esc(t.nome)} (${esc(t.turno)})</option>`;
        }
    });

    let html = '<table class="tabela-remanejar"><thead><tr><th>Aluno</th><th>Turma de Destino</th></tr></thead><tbody>';
    snap.forEach(d => {
        html += `<tr><td>${esc(d.data().nome)}</td><td><select data-aluno-id="${esc(d.id)}">${options}</select></td></tr>`;
    });
    html += '</tbody></table>';
    conteudo.innerHTML = html;
};

window.fecharModalRemanejar = function() {
    el('modalRemanejar').classList.add('hidden');
};

window.salvarRemanejamentoIndividual = async function() {
    let movidos = 0;
    try {
        for (const select of document.querySelectorAll('#conteudoRemanejar select')) {
            if (select.value) {
                await updateDoc(
                    doc(db, "alunos", select.getAttribute('data-aluno-id')),
                    { turmaId: select.value }
                );
                movidos++;
            }
        }
    } catch (e) {
        alert("Erro: " + e.message);
        return;
    }

    if (movidos === 0) { alert("Nenhum aluno foi selecionado."); return; }

    alert(`✅ ${movidos} aluno(s) remanejado(s)!`);
    fecharModalRemanejar();
    await carregarAlunosDaTurma(estado.turmaAtual.id);
    if (typeof window.carregarTodosOsAlunos === 'function') await window.carregarTodosOsAlunos();
    await carregarTurmas();
};

// =============================================================
// NAVEGAÇÃO
// =============================================================
window.voltarParaTurma = function() {
    if (estado.fichaTemAlteracoes && !el('telaFichaAluno').classList.contains('hidden')) {
        if (!confirm("⚠️ Você tem alterações não salvas na ficha do aluno.\n\nDeseja realmente sair sem salvar?")) return;
    }
    estado.fichaTemAlteracoes = false;
    el('telaFichaAluno').classList.add('hidden');
    el('telaTurmaDetalhe').classList.remove('hidden');
};

window.voltarParaTurmas = function() {
    if (estado.fichaTemAlteracoes && !el('telaFichaAluno').classList.contains('hidden')) {
        if (!confirm("⚠️ Você tem alterações não salvas na ficha do aluno.\n\nDeseja realmente voltar sem salvar?")) return;
    }
    estado.fichaTemAlteracoes = false;
    el('telaTurmaDetalhe').classList.add('hidden');
    el('telaFichaAluno').classList.add('hidden');
    el('telaConfig').classList.add('hidden');
    el('telaTurmas').classList.remove('hidden');
    el('campoBusca').value = "";
    el('listaSugestoes').classList.add('hidden');
    carregarTurmas();
};