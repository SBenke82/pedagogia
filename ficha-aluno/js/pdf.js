// =============================================================
// pdf.js
// Motor de PDF com jsPDF puro (sem html2canvas)
// =============================================================

export const PDF_CONFIG = {
    margem: 12,
    alturaPagina: 297,
    larguraPagina: 210,
    fonteBase: 'helvetica',
    tamanhoBase: 10,
    corPrimaria: [74, 108, 247],
    corTexto: [0, 0, 0],
    corCinza: [120, 120, 120],
    corCinzaClaro: [200, 200, 200],
    corAviso: [243, 156, 18],
    corPerigo: [231, 76, 60]
};

// =============================================================
// UTILITÁRIOS
// =============================================================
export function larguraUtil() { return PDF_CONFIG.larguraPagina - PDF_CONFIG.margem * 2; }
export function yInicial() { return PDF_CONFIG.margem; }
export function yFinal() { return PDF_CONFIG.alturaPagina - PDF_CONFIG.margem - 5; }

export function criarDocPDF(titulo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setProperties({ title: titulo || 'Documento' });
    doc.setFont(PDF_CONFIG.fonteBase, 'normal');
    doc.setFontSize(PDF_CONFIG.tamanhoBase);
    return doc;
}

export function novaPaginaSeNecessario(doc, y, alturaNecessaria) {
    if (y + alturaNecessaria > yFinal()) {
        doc.addPage();
        return yInicial();
    }
    return y;
}

// =============================================================
// LIMPEZA DE TEXTO
// =============================================================
export function limparTexto(texto) {
    if (!texto) return '';
    return String(texto)
        .normalize('NFC')
        .replace(/[^A-Za-z0-9À-ÿ\s.,;:!?()\[\]{}'"\/\\@#$%&*+=<>_|\-–—ºª°²³¹⁰]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
export function limparEmojis(texto) { return limparTexto(texto); }

function truncarTexto(doc, texto, larguraMax) {
    texto = limparTexto(String(texto || ''));
    if (doc.getTextWidth(texto) <= larguraMax) return texto;
    let t = texto;
    while (t.length > 0 && doc.getTextWidth(t + '...') > larguraMax) {
        t = t.substring(0, t.length - 1);
    }
    return t + '...';
}

// =============================================================
// TEXTO COM QUEBRA
// =============================================================
export function escreverTexto(doc, texto, x, y, opcoes = {}) {
    const {
        largura = larguraUtil(),
        tamanho = PDF_CONFIG.tamanhoBase,
        estilo = 'normal',
        cor = PDF_CONFIG.corTexto,
        alinhamento = 'left',
        espacamentoLinha = 1.4
    } = opcoes;

    doc.setFont(PDF_CONFIG.fonteBase, estilo);
    doc.setFontSize(tamanho);
    doc.setTextColor(cor[0], cor[1], cor[2]);

    const textoLimpo = limparTexto(texto);
    const paragrafos = textoLimpo.split('\n');
    const linhas = [];
    paragrafos.forEach(p => {
        if (p === '') { linhas.push(''); return; }
        const palavras = p.split(/\s+/);
        let linhaAtual = '';
        palavras.forEach(palavra => {
            const teste = linhaAtual ? linhaAtual + ' ' + palavra : palavra;
            if (doc.getTextWidth(teste) <= largura) linhaAtual = teste;
            else { if (linhaAtual) linhas.push(linhaAtual); linhaAtual = palavra; }
        });
        if (linhaAtual) linhas.push(linhaAtual);
    });

    const alturaLinha = tamanho * 0.3528 * espacamentoLinha;
    linhas.forEach(linha => {
        if (y + alturaLinha > yFinal()) { doc.addPage(); y = yInicial(); }
        let xTexto = x;
        if (alinhamento === 'center') xTexto = x + (largura - doc.getTextWidth(linha)) / 2;
        if (alinhamento === 'right') xTexto = x + (largura - doc.getTextWidth(linha));
        doc.text(linha, xTexto, y);
        y += alturaLinha;
    });
    return y;
}

export function calcularAlturaBloco(doc, texto, tamanho = 10) {
    const largura = larguraUtil();
    const alturaLinha = tamanho * 0.3528 * 1.4;
    doc.setFont(PDF_CONFIG.fonteBase, 'normal');
    doc.setFontSize(tamanho);

    const textoLimpo = limparTexto(texto);
    const paragrafos = textoLimpo.split('\n');
    let numLinhas = 0;
    paragrafos.forEach(p => {
        if (p === '') { numLinhas++; return; }
        const palavras = p.split(/\s+/);
        let atual = '';
        palavras.forEach(pal => {
            const teste = atual ? atual + ' ' + pal : pal;
            if (doc.getTextWidth(teste) <= largura - 4) atual = teste;
            else { if (atual) numLinhas++; atual = pal; }
        });
        if (atual) numLinhas++;
    });
    return numLinhas * alturaLinha + 4;
}

// =============================================================
// TÍTULO
// =============================================================
export function desenharTitulo(doc, texto, x, y, corFundo = null) {
    const alturaFaixa = 8;
    y = novaPaginaSeNecessario(doc, y, alturaFaixa + 3);
    const cor = corFundo || PDF_CONFIG.corPrimaria;
    doc.setFillColor(...cor);
    doc.rect(x, y, larguraUtil(), alturaFaixa, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(PDF_CONFIG.fonteBase, 'bold');
    doc.setFontSize(11);
    doc.text(limparTexto(texto), x + 2, y + 5.5);
    doc.setTextColor(...PDF_CONFIG.corTexto);
    return y + alturaFaixa + 3;
}

// =============================================================
// TABELA 3 COLUNAS
// =============================================================
export function desenharTabela3Col(doc, cabecalho, linhas, x, y) {
    const larg = [90, 30, larguraUtil() - 120];
    const alturaLinha = 6;
    const padding = 1.5;

    y = novaPaginaSeNecessario(doc, y, alturaLinha);
    doc.setFillColor(230, 235, 250);
    doc.setDrawColor(150, 150, 150);
    doc.rect(x, y, larguraUtil(), alturaLinha, 'FD');
    doc.setFont(PDF_CONFIG.fonteBase, 'bold');
    doc.setFontSize(9);
    let xi = x;
    cabecalho.forEach((txt, i) => {
        doc.text(limparTexto(String(txt)), xi + padding, y + 4);
        xi += larg[i];
    });
    y += alturaLinha;

    doc.setFont(PDF_CONFIG.fonteBase, 'normal');
    linhas.forEach(linha => {
        y = novaPaginaSeNecessario(doc, y, alturaLinha);
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, larguraUtil(), alturaLinha, 'D');
        let xc = x;
        linha.forEach((txt, i) => {
            doc.text(limparTexto(String(txt)), xc + padding, y + 4);
            xc += larg[i];
        });
        y += alturaLinha;
    });
    return y + 3;
}

// =============================================================
// BLOCO COM BORDA
// =============================================================
export function desenharBloco(doc, texto, x, y, opcoes = {}) {
    const { corFundo = null, corBorda = [180, 180, 180], estilo = 'normal', tamanho = 10 } = opcoes;
    const largura = larguraUtil();
    const alturaLinha = tamanho * 0.3528 * 1.4;

    doc.setFont(PDF_CONFIG.fonteBase, estilo);
    doc.setFontSize(tamanho);

    const textoLimpo = limparTexto(texto);
    const paragrafos = textoLimpo.split('\n');
    const linhas = [];
    paragrafos.forEach(p => {
        if (p === '') { linhas.push(''); return; }
        const palavras = p.split(/\s+/);
        let atual = '';
        palavras.forEach(pal => {
            const teste = atual ? atual + ' ' + pal : pal;
            if (doc.getTextWidth(teste) <= largura - 4) atual = teste;
            else { if (atual) linhas.push(atual); atual = pal; }
        });
        if (atual) linhas.push(atual);
    });

    const alturaBloco = linhas.length * alturaLinha + 4;
    y = novaPaginaSeNecessario(doc, y, alturaBloco);

    if (corFundo) {
        doc.setFillColor(...corFundo);
        doc.rect(x, y, largura, alturaBloco, 'F');
    }
    doc.setDrawColor(...corBorda);
    doc.rect(x, y, largura, alturaBloco, 'D');

    let yl = y + 4;
    linhas.forEach(l => { doc.text(l, x + 2, yl); yl += alturaLinha; });
    return y + alturaBloco + 3;
}

// =============================================================
// IMAGEM
// =============================================================
export function carregarImagemBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            try { resolve(c.toDataURL('image/jpeg', 0.85)); }
            catch (e) { reject(e); }
        };
        img.onerror = reject;
        img.src = url;
    });
}

// =============================================================
// BUSCAR DADOS DA ESCOLA
// =============================================================
export async function buscarDadosEscola() {
    try {
        const { db } = await import('./config.js');
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const snap = await getDoc(doc(db, "config", "aparencia"));
        if (snap.exists()) {
            const d = snap.data();
            if (d.nomeEscola) return { nome: d.nomeEscola, logo: d.logoUrl || '' };
        }
    } catch (e) {
        console.warn("Não conseguiu ler aparência do Firestore:", e);
    }
    return {
        nome: localStorage.getItem('nomeEscola') || 'Escola Municipal',
        logo: localStorage.getItem('logoUrl') || ''
    };
}

// =============================================================
// CABEÇALHO (só logo + nome da escola — sem foto)
// =============================================================
export async function desenharCabecalho(doc, subtitulo, opcoes = {}) {
    const { incluirLogo = true } = opcoes;
    const escola = await buscarDadosEscola();
    let y = yInicial();
    const alturaCabecalho = 22;

    if (incluirLogo && escola.logo) {
        try {
            const dataUrl = await carregarImagemBase64(escola.logo);
            doc.addImage(dataUrl, 'PNG', PDF_CONFIG.margem, y, 18, 18);
        } catch (e) { console.warn('Logo não carregada:', e); }
    }

    const xTexto = (incluirLogo && escola.logo) ? PDF_CONFIG.margem + 22 : PDF_CONFIG.margem;
    const larguraTexto = PDF_CONFIG.larguraPagina - xTexto - PDF_CONFIG.margem;

    doc.setFont(PDF_CONFIG.fonteBase, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    const nomeEscolaLimpo = limparTexto(escola.nome.toUpperCase());
    doc.text(truncarTexto(doc, nomeEscolaLimpo, larguraTexto), xTexto + larguraTexto / 2, y + 6, { align: 'center' });

    if (subtitulo) {
        doc.setFont(PDF_CONFIG.fonteBase, 'normal');
        doc.setFontSize(10);
        doc.text(limparTexto(subtitulo), xTexto + larguraTexto / 2, y + 13, { align: 'center' });
    }

    y += alturaCabecalho;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(PDF_CONFIG.margem, y, PDF_CONFIG.larguraPagina - PDF_CONFIG.margem, y);
    return y + 5;
}

// =============================================================
// RODAPÉ
// =============================================================
export function adicionarRodape(doc, opcoes = {}) {
    const { emitidoEm = true, numeracao = true, textoDireita = '' } = opcoes;
    const total = doc.internal.getNumberOfPages();
    const hoje = new Date().toLocaleDateString('pt-BR');
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFont(PDF_CONFIG.fonteBase, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...PDF_CONFIG.corCinza);

        if (numeracao) {
            doc.text(`Página ${i} de ${total}`, PDF_CONFIG.larguraPagina / 2, PDF_CONFIG.alturaPagina - 6, { align: 'center' });
        }
        if (emitidoEm) {
            doc.text(`Emitido em ${hoje}`, PDF_CONFIG.margem, PDF_CONFIG.alturaPagina - 6);
        }
        if (textoDireita) {
            doc.text(limparTexto(textoDireita), PDF_CONFIG.larguraPagina - PDF_CONFIG.margem, PDF_CONFIG.alturaPagina - 6, { align: 'right' });
        }
    }
}

// =============================================================
// FOTO DO ALUNO (bloco reutilizável)
// =============================================================
async function desenharFotoAluno(doc, fotoUrl, y) {
    if (!fotoUrl) return y;
    try {
        const dataUrl = await carregarImagemBase64(fotoUrl);
        const alturaFoto = 50;   // ~5cm
        const larguraFoto = 40;  // ~4cm
        y = novaPaginaSeNecessario(doc, y, alturaFoto + 6);

        doc.setDrawColor(180, 180, 180);
        doc.rect(PDF_CONFIG.margem, y, larguraFoto, alturaFoto, 'D');
        doc.addImage(dataUrl, 'JPEG',
            PDF_CONFIG.margem + 0.5, y + 0.5,
            larguraFoto - 1, alturaFoto - 1
        );
        return y + alturaFoto + 6;
    } catch (e) {
        console.warn('Foto não carregada:', e);
        return y;
    }
}

// =============================================================
// DADOS DO ALUNO
// =============================================================
export async function desenharDadosAluno(doc, aluno, turma, y, opcoes = {}) {
    const { incluirIdade = true } = opcoes;

    const dados = [
        ['Nome:', aluno.nome || '-'],
        ['CGM:', aluno.cgm || '-'],
        ['Data Nasc:', aluno.dataNasc ? formatarDataBR(aluno.dataNasc) : '-'],
        ['Idade:', incluirIdade && aluno.dataNasc ? calcularIdade(aluno.dataNasc) + ' anos' : '-'],
        ['Turma:', turma.nome || '-'],
        ['Turno:', turma.turno || '-'],
        ['Professor(a):', turma.professor || '-'],
        ['Pedagogo(a):', turma.pedagogo || '-'],
        ['Unidade Origem:', aluno.unidadeOrigem || '-']
    ];

    const colLarg = larguraUtil() / 2;
    const alturaLinha = 6;
    const padding = 1.5;

    doc.setFontSize(9);

    for (let i = 0; i < dados.length; i += 2) {
        y = novaPaginaSeNecessario(doc, y, alturaLinha);
        doc.setFillColor(245, 247, 252);
        doc.setDrawColor(200, 200, 200);
        doc.rect(PDF_CONFIG.margem, y, colLarg, alturaLinha, 'FD');
        doc.rect(PDF_CONFIG.margem + colLarg, y, colLarg, alturaLinha, 'FD');

        const rotulo1 = limparTexto(dados[i][0]);
        const valor1 = limparTexto(String(dados[i][1]));
        doc.setFont(PDF_CONFIG.fonteBase, 'bold');
        doc.setTextColor(0, 0, 0);
        const larguraRot1 = doc.getTextWidth(rotulo1);
        doc.text(rotulo1, PDF_CONFIG.margem + padding, y + 4);
        doc.setFont(PDF_CONFIG.fonteBase, 'normal');
        const larguraDisp1 = colLarg - larguraRot1 - padding * 3;
        doc.text(truncarTexto(doc, valor1, larguraDisp1), PDF_CONFIG.margem + padding + larguraRot1 + 1, y + 4);

        if (dados[i + 1]) {
            const rotulo2 = limparTexto(dados[i + 1][0]);
            const valor2 = limparTexto(String(dados[i + 1][1]));
            const xColDir = PDF_CONFIG.margem + colLarg;
            doc.setFont(PDF_CONFIG.fonteBase, 'bold');
            const larguraRot2 = doc.getTextWidth(rotulo2);
            doc.text(rotulo2, xColDir + padding, y + 4);
            doc.setFont(PDF_CONFIG.fonteBase, 'normal');
            const larguraDisp2 = colLarg - larguraRot2 - padding * 3;
            doc.text(truncarTexto(doc, valor2, larguraDisp2), xColDir + padding + larguraRot2 + 1, y + 4);
        }
        y += alturaLinha;
    }
    return y + 4;
}

// =============================================================
// ENCAMINHAMENTOS
// =============================================================
export function desenharEncaminhamentos(doc, aluno, y, apenasSim = false) {
    const categorias = [
        { titulo: 'Encaminhamentos de Saúde', itens: [
            ['Psicológico', 'saude_psicologico'],
            ['Fonoaudiológico', 'saude_fono'],
            ['Neurológico', 'saude_neuro'],
            ['Pediatra', 'saude_pediatra']
        ], obs: aluno.obs_enc_saude },
        { titulo: 'Frequenta outros atendimentos?', itens: [
            ['CMAEE-AV', 'atend_cmaee_av'],
            ['CMAEE-Surdez', 'atend_cmaee_surdez'],
            ['CMAEE-TEA', 'atend_cmaee_tea'],
            ['CMAEE-JOELMA', 'atend_cmaee_joelma']
        ], obs: aluno.obs_enc_atend },
        { titulo: 'Encaminhamentos Sociais', itens: [
            ['Rede de Proteção', 'social_rede'],
            ['Busca Ativa', 'social_busca'],
            ['Conselho Tutelar', 'social_conselho'],
            ['SERP', 'social_serp'],
            ['SINAN', 'social_sinan']
        ], obs: aluno.obs_enc_social }
    ];

    for (const cat of categorias) {
        const linhas = cat.itens.map(([rot, k]) => ({
            rot, k,
            valor: aluno[k] || 'Não',
            data: aluno[k + '_data'] ? formatarDataBR(aluno[k + '_data']) : '-',
            sim: (aluno[k] || 'Não').toString().toLowerCase() === 'sim'
        }));

        const linhasFiltradas = apenasSim ? linhas.filter(l => l.sim) : linhas;
        y = desenharTitulo(doc, cat.titulo, PDF_CONFIG.margem, y);

        if (apenasSim && linhasFiltradas.length === 0) {
            y = escreverTexto(doc, 'Nenhum encaminhamento registrado.', PDF_CONFIG.margem, y,
                { estilo: 'italic', tamanho: 9, cor: PDF_CONFIG.corCinza });
        } else {
            const dadosTabela = linhasFiltradas.map(l => [l.rot, l.sim ? 'Sim' : l.valor, l.sim ? l.data : '-']);
            y = desenharTabela3Col(doc, ['Descrição', 'Sim', 'Data'], dadosTabela, PDF_CONFIG.margem, y);
        }

        if (cat.obs && cat.obs.trim() && (!apenasSim || linhasFiltradas.length > 0)) {
            y = escreverTexto(doc, `Obs: ${cat.obs}`, PDF_CONFIG.margem, y,
                { estilo: 'italic', tamanho: 9, cor: PDF_CONFIG.corCinza });
            y += 2;
        }
    }

    if (aluno.saude_psicoeducacional === 'Sim') {
        y = desenharTitulo(doc, 'Avaliação Psicoeducacional', PDF_CONFIG.margem, y);
        if (aluno.obs_enc_psicoeducacional && aluno.obs_enc_psicoeducacional.trim()) {
            y = desenharBloco(doc, aluno.obs_enc_psicoeducacional, PDF_CONFIG.margem, y,
                { corFundo: [254, 243, 199], corBorda: PDF_CONFIG.corAviso });
        } else {
            y = escreverTexto(doc, 'Sim (sem observações).', PDF_CONFIG.margem, y, { tamanho: 9 });
        }
    } else if (!apenasSim) {
        y = escreverTexto(doc, `Avaliação Psicoeducacional: ${aluno.saude_psicoeducacional || 'Não'}`,
            PDF_CONFIG.margem, y, { estilo: 'bold', tamanho: 9 });
    }

    return y;
}

// =============================================================
// OBSERVAÇÕES
// =============================================================
export function desenharObservacoes(doc, aluno, y, opcoes = {}) {
    const { incluirEstudoCaso = true } = opcoes;
    y = desenharTitulo(doc, 'Observações / Medicações', PDF_CONFIG.margem, y);
    y = desenharBloco(doc, aluno.observacoes || 'Nenhuma.', PDF_CONFIG.margem, y);
    if (incluirEstudoCaso && aluno.estudoCaso) {
        const valor = aluno.estudoCaso === 'Nao' ? 'Não' : aluno.estudoCaso;
        y = escreverTexto(doc, `Estudo de Caso: ${valor}`, PDF_CONFIG.margem, y,
            { estilo: 'bold', tamanho: 10 });
    }
    return y;
}

// =============================================================
// ANEXOS
// =============================================================
export function desenharAnexos(doc, anexos, y) {
    if (!anexos || anexos.length === 0) return y;
    y = desenharTitulo(doc, 'Anexos', PDF_CONFIG.margem, y);
    let lista = '';
    anexos.forEach((a, i) => { lista += `${i + 1}. ${limparTexto(a.nome)}\n`; });
    y = escreverTexto(doc, lista, PDF_CONFIG.margem, y, { tamanho: 9 });
    return y;
}

// =============================================================
// CONSELHO DE CLASSE
// =============================================================
export function desenharConselho(doc, dados, ano, y) {
    if (!dados) return y;
    const infantil = dados.etapa === 'Infantil';
    const n = infantil ? 2 : 3;
    const rotulo = infantil ? 'Semestre' : 'Trimestre';

    y = desenharTitulo(doc, `Conselho de Classe - ${ano} (${infantil ? '2 Semestres' : '3 Trimestres'})`,
        PDF_CONFIG.margem, y);

    for (let i = 1; i <= n; i++) {
        const temTexto = dados['texto' + i] && dados['texto' + i].trim();
        if (!temTexto) continue;

        const tituloLinha = `${i}º ${rotulo} - Data: ${dados['data' + i] ? formatarDataBR(dados['data' + i]) : '-'}`;
        const alturaTitulo = 10 * 0.3528 * 1.4 + 2;
        const alturaTexto = calcularAlturaBloco(doc, dados['texto' + i]);
        if (y + alturaTitulo + alturaTexto > yFinal()) { doc.addPage(); y = yInicial(); }

        y = escreverTexto(doc, tituloLinha, PDF_CONFIG.margem, y, { estilo: 'bold', tamanho: 10 });
        y = desenharBloco(doc, dados['texto' + i], PDF_CONFIG.margem, y);
    }

    if (dados.status) {
        y = escreverTexto(doc, `Resultado do ano: ${dados.status}`, PDF_CONFIG.margem, y,
            { estilo: 'bold', tamanho: 10 });
    }
    return y;
}

// =============================================================
// OCORRÊNCIAS
// =============================================================
export function desenharOcorrencias(doc, ocorrencias, ano, y, opcoes = {}) {
    const { filtro = 'todas' } = opcoes;

    let ocs = ocorrencias
        .filter(o => o.data && o.data.split('-')[0] === String(ano))
        .sort((a, b) => String(a.data).localeCompare(String(b.data)));

    if (filtro === 'com_comunicado') ocs = ocs.filter(o => o.comunicado);
    if (filtro === 'sem_comunicado') ocs = ocs.filter(o => !o.comunicado);

    if (ocs.length === 0) return y;

    y = desenharTitulo(doc, `Ocorrências - ${ano}`, PDF_CONFIG.margem, y);

    for (const oc of ocs) {
        const textoOc = `${oc.dataFormatada || '-'}\n${oc.texto}`;
        const altura = calcularAlturaBloco(doc, textoOc);
        if (y + altura > yFinal()) { doc.addPage(); y = yInicial(); }

        y = desenharBloco(doc, textoOc, PDF_CONFIG.margem, y, { corBorda: PDF_CONFIG.corPerigo });

        if (oc.comunicado) {
            let linhaCom = `Convocado em ${oc.comunicado.dataFormatada} às ${oc.comunicado.hora}`;
            if (oc.compareceu && oc.compareceu.data) {
                linhaCom += `  -  Compareceu em ${oc.compareceu.dataFormatada}`;
            }
            y = escreverTexto(doc, linhaCom, PDF_CONFIG.margem + 2, y,
                { estilo: 'italic', tamanho: 8, cor: [133, 100, 4] });
            y += 2;
        }
    }
    return y;
}

// =============================================================
// ASSINATURAS (empilhadas verticalmente)
// =============================================================
export function desenharAssinaturas(doc, turma, y, opcoes = {}) {
    const {
        pedagogo = false,
        professor = false,
        apoio = false,
        responsavel = false,
        vistoDirecao = false
    } = opcoes;

    const assinaturas = [];
    if (pedagogo && turma.pedagogo) assinaturas.push({ titulo: 'Pedagogo(a)', nome: turma.pedagogo });
    if (professor && turma.professor) assinaturas.push({ titulo: 'Professor(a)', nome: turma.professor });
    if (apoio && turma.professorApoio) assinaturas.push({ titulo: 'Prof. de Apoio', nome: turma.professorApoio });
    if (responsavel) assinaturas.push({ titulo: 'Responsável', nome: '' });
    if (vistoDirecao) assinaturas.push({ titulo: 'Visto da Direção', nome: '' });

    if (assinaturas.length === 0) return y;

    const larguraLinha = 100;
    const alturaBloco = 25;

    // Espaço antes da primeira assinatura
    y += 15;

    for (let i = 0; i < assinaturas.length; i++) {
        y = novaPaginaSeNecessario(doc, y, alturaBloco);

        const xCentro = PDF_CONFIG.larguraPagina / 2;
        const xLinhaIni = xCentro - larguraLinha / 2;
        const xLinhaFim = xCentro + larguraLinha / 2;

        if (i > 0) y += 20;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(xLinhaIni, y, xLinhaFim, y);

        doc.setFont(PDF_CONFIG.fonteBase, 'normal');
        doc.setFontSize(9);

        const txtAss = assinaturas[i].nome
            ? `${assinaturas[i].titulo}: ${limparTexto(assinaturas[i].nome)}`
            : assinaturas[i].titulo;

        doc.text(truncarTexto(doc, txtAss, larguraLinha + 20), xCentro, y + 5, { align: 'center' });
        y += 5;
    }
    return y + 8;
}

// =============================================================
// HELPERS
// =============================================================
export function formatarDataBR(iso) {
    if (!iso) return '-';
    if (String(iso).includes('/')) return iso;
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}/${a}`;
}

export function calcularIdade(dataNasc) {
    if (!dataNasc) return 0;
    const hoje = new Date(), nasc = new Date(dataNasc + 'T00:00:00');
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
}

export function limparNomeArquivo(nome) {
    return String(nome || 'arquivo')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 60);
}

function aplicarEstilo(config) {
    if (config.estilo_monocromatico) PDF_CONFIG.corPrimaria = [60, 60, 60];
    else PDF_CONFIG.corPrimaria = [74, 108, 247];
    const tam = config.estilo_tamanho_fonte;
    if (tam === 'pequena') PDF_CONFIG.tamanhoBase = 9;
    else if (tam === 'grande') PDF_CONFIG.tamanhoBase = 12;
    else PDF_CONFIG.tamanhoBase = 10;
}

// =============================================================
// PDF: RELATÓRIO COMPLETO
// =============================================================
export async function gerarPDFRelatorioAluno(aluno, turma, opcoes = {}) {
    const {
        ano = new Date().getFullYear(),
        fichas = {},
        ocorrencias = [],
        relatorios = [],
        anexos = [],
        config = {}
    } = opcoes;

    aplicarEstilo(config);
    const doc = criarDocPDF(`Relatório - ${aluno.nome}`);

    // Foto do ano (se pedida)
    let fotoUrl = null;
    if (config.relatorio_foto) {
        if (aluno.fotos && aluno.fotos.length > 0) {
            const doAno = aluno.fotos.find(f => String(f.ano) === String(ano));
            fotoUrl = doAno ? doAno.url : (aluno.fotoUrl || null);
        } else {
            fotoUrl = aluno.fotoUrl || null;
        }
    }

    let y = await desenharCabecalho(doc, 'Ficha de Acompanhamento Individual', {
        incluirLogo: config.relatorio_cabecalho_logo
    });

    y = escreverTexto(doc, 'FICHA DE ACOMPANHAMENTO INDIVIDUAL', PDF_CONFIG.margem, y,
        { estilo: 'bold', tamanho: 13, alinhamento: 'center' });
    y += 3;

    y = await desenharDadosAluno(doc, aluno, turma, y, {
        incluirIdade: config.relatorio_idade
    });

    // Foto abaixo dos dados
    if (fotoUrl) y = await desenharFotoAluno(doc, fotoUrl, y);

    if (config.relatorio_encaminhamentos) {
        y = desenharEncaminhamentos(doc, aluno, y, config.mostrar_somente_encaminhamentos);
    }
    if (config.relatorio_observacoes) {
        y = desenharObservacoes(doc, aluno, y, { incluirEstudoCaso: config.relatorio_estudo_caso });
    }
    if (config.relatorio_anexos && anexos.length > 0) {
        y = desenharAnexos(doc, anexos, y);
    }
    if (config.relatorio_incluir_conselho && fichas[String(ano)]) {
        y = desenharConselho(doc, fichas[String(ano)], ano, y);
    }
    if (config.relatorio_incluir_ocorrencias && ocorrencias.length > 0) {
        y = desenharOcorrencias(doc, ocorrencias, ano, y, { filtro: 'todas' });
    }

    if ((config.relatorio_incluir_relatorios_estudante || config.relatorio_incluir_relatorios_inclusao) && relatorios.length > 0) {
        let relsAno = relatorios.filter(r => String(r.ano) === String(ano));
        if (!config.relatorio_incluir_relatorios_estudante) relsAno = relsAno.filter(r => r.tipo !== 'estudante');
        if (!config.relatorio_incluir_relatorios_inclusao) relsAno = relsAno.filter(r => r.tipo !== 'inclusao');

        for (const r of relsAno) {
            doc.addPage();
            y = yInicial();
            y = await desenharCabecalho(doc, `Relatório ${r.tipo === 'inclusao' ? 'de Inclusão' : 'do Estudante'} - ${r.ano}`, {
                incluirLogo: config.relatorio_cabecalho_logo
            });
            y = escreverTexto(doc, aluno.nome, PDF_CONFIG.margem, y, { estilo: 'bold', tamanho: 11 });
            y += 2;

            if (r.tipo === 'inclusao') {
                const blocos = [
                    ['Breve relato de medicações e atendimentos', r.medicacoes],
                    ['Comunicação', r.comunicacao],
                    ['Interação social / Comportamento', r.interacao],
                    ['Locomoção', r.locomocao],
                    ['Alimentação, cuidados pessoais', r.alimentacao],
                    ['Aprendizagem e desenvolvimento', r.aprendizagem]
                ];
                for (const [titulo, txt] of blocos) {
                    if (!txt || !txt.trim()) continue;
                    const alturaTit = 8;
                    const alturaBloco = calcularAlturaBloco(doc, txt);
                    if (y + alturaTit + alturaBloco > yFinal()) { doc.addPage(); y = yInicial(); }
                    y = escreverTexto(doc, titulo + ':', PDF_CONFIG.margem, y, { estilo: 'bold', tamanho: 10 });
                    y = desenharBloco(doc, txt, PDF_CONFIG.margem, y);
                }
            } else {
                y = desenharBloco(doc, r.texto || '', PDF_CONFIG.margem, y);
            }
        }
    }

    if (config.relatorio_assinatura_pedagogo || config.relatorio_assinatura_professor ||
        config.relatorio_assinatura_apoio || config.relatorio_assinatura_responsavel ||
        config.relatorio_visto_direcao) {
        y = desenharAssinaturas(doc, turma, y, {
            pedagogo: config.relatorio_assinatura_pedagogo,
            professor: config.relatorio_assinatura_professor,
            apoio: config.relatorio_assinatura_apoio,
            responsavel: config.relatorio_assinatura_responsavel,
            vistoDirecao: config.relatorio_visto_direcao
        });
    }

    adicionarRodape(doc, {
        emitidoEm: config.relatorio_rodape_emissao,
        numeracao: config.relatorio_numeracao_pagina
    });

    doc.save(`Relatorio_${limparNomeArquivo(aluno.nome)}_${ano}.pdf`);
    return doc;
}

// =============================================================
// PDF: OCORRÊNCIAS
// =============================================================
export async function gerarPDFOcorrencias(aluno, turma, ocorrencias, ano, opcoes = {}) {
    const { config = {}, anexos = [] } = opcoes;
    aplicarEstilo(config);

    const doc = criarDocPDF(`Ocorrências - ${aluno.nome}`);

    let fotoUrl = null;
    if (config.ocorrencias_foto) {
        if (aluno.fotos && aluno.fotos.length > 0) {
            const doAno = aluno.fotos.find(f => String(f.ano) === String(ano));
            fotoUrl = doAno ? doAno.url : (aluno.fotoUrl || null);
        } else {
            fotoUrl = aluno.fotoUrl || null;
        }
    }

    let y = await desenharCabecalho(doc, 'Relatório de Ocorrências', {
        incluirLogo: config.ocorrencias_cabecalho_logo
    });

    y = escreverTexto(doc, `Aluno: ${aluno.nome}`, PDF_CONFIG.margem, y, { estilo: 'bold', tamanho: 11 });
    y = escreverTexto(doc, `Turma: ${turma.nome}  |  Turno: ${turma.turno}  |  Ano: ${ano}`,
        PDF_CONFIG.margem, y, { tamanho: 10 });
    y += 3;

    // Foto abaixo do cabeçalho
    if (fotoUrl) y = await desenharFotoAluno(doc, fotoUrl, y);

    if (config.ocorrencias_encaminhamentos) y = desenharEncaminhamentos(doc, aluno, y, false);
    if (config.ocorrencias_observacoes) {
        y = desenharObservacoes(doc, aluno, y, { incluirEstudoCaso: config.ocorrencias_estudo_caso });
    }
    if (config.ocorrencias_anexos && anexos.length > 0) y = desenharAnexos(doc, anexos, y);

    y = desenharOcorrencias(doc, ocorrencias, ano, y, { filtro: config.ocorrencias_filtro });

    if (config.ocorrencias_assinatura_pedagogo || config.ocorrencias_assinatura_professor ||
        config.ocorrencias_assinatura_apoio || config.ocorrencias_assinatura_responsavel) {
        y = desenharAssinaturas(doc, turma, y, {
            pedagogo: config.ocorrencias_assinatura_pedagogo,
            professor: config.ocorrencias_assinatura_professor,
            apoio: config.ocorrencias_assinatura_apoio,
            responsavel: config.ocorrencias_assinatura_responsavel
        });
    }

    adicionarRodape(doc, {
        emitidoEm: config.ocorrencias_rodape_emissao,
        numeracao: config.ocorrencias_numeracao_pagina
    });

    doc.save(`Ocorrencias_${limparNomeArquivo(aluno.nome)}_${ano}.pdf`);
}

// =============================================================
// PDF: CONVOCAÇÃO
// =============================================================
export async function gerarPDFConvocacao(aluno, turma, ocorrencia) {
    const oc = ocorrencia;
    if (!oc || !oc.comunicado) { alert("Nenhuma convocação registrada."); return; }

    const doc = criarDocPDF(`Convocação - ${aluno.nome}`);
    let y = await desenharCabecalho(doc, 'Secretaria Municipal de Educação');

    y = escreverTexto(doc, `Aluno(a): ${aluno.nome}`, PDF_CONFIG.margem, y, { estilo: 'bold', tamanho: 11 });
    y = escreverTexto(doc, `Turma: ${turma.nome}  |  Turno: ${turma.turno}`, PDF_CONFIG.margem, y);
    y = escreverTexto(doc, `Data: ${oc.comunicado.dataFormatada}  |  Horário: ${oc.comunicado.hora}`,
        PDF_CONFIG.margem, y);
    y += 5;

    y = escreverTexto(doc, 'Senhores Pais e/ou responsáveis:', PDF_CONFIG.margem, y, { estilo: 'bold' });
    y += 2;
    y = escreverTexto(doc,
        'A Lei nº 8.069, artigo 129 (inciso 5º) do Estatuto da Criança e do Adolescente rege que: os pais têm a obrigação de matricular o filho(a) na Escola, acompanhar sua frequência e aproveitamento escolar.',
        PDF_CONFIG.margem, y);
    y += 3;
    y = escreverTexto(doc,
        'Pedimos que compareça a Escola, para conversarmos a respeito de seu filho(a):',
        PDF_CONFIG.margem, y);
    y += 4;

    y = desenharBloco(doc,
        `Turma: ${turma.nome}  |  Turno: ${turma.turno}\nData: ${oc.comunicado.dataFormatada}  |  Horário: ${oc.comunicado.hora}`,
        PDF_CONFIG.margem, y);

    y = escreverTexto(doc, 'Evitando assim danos futuros à própria criança.', PDF_CONFIG.margem, y);
    y += 8;
    y = escreverTexto(doc, 'Atenciosamente', PDF_CONFIG.larguraPagina - PDF_CONFIG.margem, y, { alinhamento: 'right' });
    const escola = await buscarDadosEscola();
    y = escreverTexto(doc, escola.nome, PDF_CONFIG.larguraPagina - PDF_CONFIG.margem, y,
        { alinhamento: 'right', estilo: 'bold' });
    y += 20;

    const xAss = PDF_CONFIG.larguraPagina / 2;
    doc.setDrawColor(0, 0, 0);
    doc.line(xAss - 45, y, xAss + 45, y);
    y += 4;
    doc.setFontSize(9);
    doc.text('Assinatura do Responsável', xAss, y, { align: 'center' });

    adicionarRodape(doc);
    doc.save(`Convocacao_${limparNomeArquivo(aluno.nome)}.pdf`);
}

// =============================================================
// PDF: FICHA SIMPLES
// =============================================================
export async function gerarPDFFichaSimples(aluno, turma) {
    const doc = criarDocPDF(`Ficha - ${aluno.nome}`);
    let y = await desenharCabecalho(doc, 'Ficha de Acompanhamento Individual');

    y = escreverTexto(doc, 'FICHA DE ACOMPANHAMENTO INDIVIDUAL', PDF_CONFIG.margem, y,
        { estilo: 'bold', tamanho: 13, alinhamento: 'center' });
    y += 3;
    y = await desenharDadosAluno(doc, aluno, turma, y, { incluirIdade: true });
    y = desenharEncaminhamentos(doc, aluno, y, false);
    y = desenharObservacoes(doc, aluno, y, { incluirEstudoCaso: true });

    adicionarRodape(doc, { emitidoEm: true, numeracao: true });
    doc.save(`Ficha_${limparNomeArquivo(aluno.nome)}.pdf`);
}

// =============================================================
// PDF: ANEXO
// =============================================================
export async function gerarPDFAnexo(url, nome) {
    const doc = criarDocPDF(nome);
    try {
        const dataUrl = await carregarImagemBase64(url);
        const img = new Image();
        img.src = dataUrl;
        await new Promise(r => { img.onload = r; });

        const maxW = larguraUtil();
        const maxH = PDF_CONFIG.alturaPagina - PDF_CONFIG.margem * 2 - 20;
        let w = img.naturalWidth, h = img.naturalHeight;
        const escala = Math.min(maxW / w, maxH / h, 1);
        w *= escala; h *= escala;

        doc.setFontSize(12);
        doc.setFont(PDF_CONFIG.fonteBase, 'bold');
        doc.text(limparTexto(nome), PDF_CONFIG.larguraPagina / 2, PDF_CONFIG.margem + 5, { align: 'center' });
        doc.addImage(dataUrl, 'JPEG',
            (PDF_CONFIG.larguraPagina - w) / 2,
            PDF_CONFIG.margem + 12, w, h);
    } catch (e) {
        alert("Erro ao gerar PDF do anexo: " + e.message);
        return;
    }
    doc.save(`${limparNomeArquivo(nome)}.pdf`);
}

// =============================================================
// PDF: LOTE (turma)
// =============================================================
export async function gerarPDFLoteTurma(alunos, turma, opcoes = {}) {
    const { ano = new Date().getFullYear(), config = {} } = opcoes;
    aplicarEstilo(config);

    const doc = criarDocPDF(`Turma ${turma.nome} - ${ano}`);
    let primeiraPagina = true;

    for (const aluno of alunos) {
        if (!primeiraPagina) doc.addPage();
        primeiraPagina = false;

        let fotoUrl = null;
        if (config.relatorio_foto) {
            if (aluno.fotos && aluno.fotos.length > 0) {
                const doAno = aluno.fotos.find(f => String(f.ano) === String(ano));
                fotoUrl = doAno ? doAno.url : (aluno.fotoUrl || null);
            } else {
                fotoUrl = aluno.fotoUrl || null;
            }
        }

        let y = await desenharCabecalho(doc, 'Ficha de Acompanhamento Individual', {
            incluirLogo: config.relatorio_cabecalho_logo
        });

        y = await desenharDadosAluno(doc, aluno, turma, y, {
            incluirIdade: config.relatorio_idade
        });

        if (fotoUrl) y = await desenharFotoAluno(doc, fotoUrl, y);

        if (config.relatorio_encaminhamentos) {
            y = desenharEncaminhamentos(doc, aluno, y, config.mostrar_somente_encaminhamentos);
        }
        if (config.relatorio_observacoes) {
            y = desenharObservacoes(doc, aluno, y, { incluirEstudoCaso: config.relatorio_estudo_caso });
        }
        if (config.relatorio_incluir_conselho && aluno.__fichas && aluno.__fichas[String(ano)]) {
            y = desenharConselho(doc, aluno.__fichas[String(ano)], ano, y);
        }
        if (config.relatorio_incluir_ocorrencias && aluno.ocorrencias) {
            y = desenharOcorrencias(doc, aluno.ocorrencias, ano, y, { filtro: 'todas' });
        }

        if (config.relatorio_assinatura_pedagogo || config.relatorio_assinatura_professor ||
            config.relatorio_assinatura_apoio || config.relatorio_assinatura_responsavel ||
            config.relatorio_visto_direcao) {
            y = desenharAssinaturas(doc, turma, y, {
                pedagogo: config.relatorio_assinatura_pedagogo,
                professor: config.relatorio_assinatura_professor,
                apoio: config.relatorio_assinatura_apoio,
                responsavel: config.relatorio_assinatura_responsavel,
                vistoDirecao: config.relatorio_visto_direcao
            });
        }
    }

    adicionarRodape(doc, {
        emitidoEm: config.relatorio_rodape_emissao,
        numeracao: config.relatorio_numeracao_pagina
    });

    doc.save(`Turma_${limparNomeArquivo(turma.nome)}_${ano}.pdf`);
}