/* =====================================================================
 * FÓRMULAS das abas de cálculo (Tabela Geral, Individual, Progresso,
 * Calibracao e a aba oculta _Aux).
 *
 * Tudo é calculado pela própria planilha, ligando as abas por ID
 * (nunca pelo texto do nome). As fórmulas usam funções do Google Sheets
 * (LET, LAMBDA, MAP, MAKEARRAY, FILTER, XLOOKUP, AVERAGEIFS, COUNTIFS).
 *
 * Regras (seção 10 do escopo):
 *  - "NA" e vazio são ignorados nas médias.
 *  - Média do critério = média das notas numéricas da etapa selecionada.
 *  - Média geral = média ponderada pelos pesos dos critérios que têm nota.
 *  - Ranking por competição só para status ATIVO, comparando o valor sem
 *    arredondar (9 casas, para evitar ruído de ponto flutuante).
 * ===================================================================== */

/**
 * Mapa da aba _Aux (oculta). Colunas:
 *  A:B  parâmetros (etapa filtrada, etapa do progresso, contagens, config)
 *  D:L  critérios ativos  (id, bloco, peso, sigla, nome, ordem_bloco, ordem, etapas, rótulo)
 *  N:Q  blocos ativos     (id, nome, nome_curto, ordem)
 *  S:W  avaliações filtradas pela etapa da Tabela Geral (etapa, avaliador, candidato, critério, nota)
 *  Y:AC só as notas numéricas de S:W
 *  AE:AG respostas da etapa do Progresso (avaliador, candidato, critério)
 *  AI   critérios exigidos na etapa do Progresso
 *  AK:AL candidatos para o dropdown da Tabela Individual (id, rótulo)
 *  AN   etapas para o dropdown da Tabela Geral (com "Todas")
 *  AO   etapas para o dropdown do Progresso
 */
var AUX = {
  ETAPA_FILTRO: "'_Aux'!$B$1",
  ETAPA_PROG: "'_Aux'!$B$2",
  N_CRIT_PROG: "'_Aux'!$B$3",
  N_CRIT: "'_Aux'!$B$4",
  CORTE: "'_Aux'!$B$5",
  VAGAS: "'_Aux'!$B$6",
  MIN_AVAL: "'_Aux'!$B$7",
  LIMITE: "'_Aux'!$B$8",
  NOME_PROC: "'_Aux'!$B$9",
  CAND_SEL: "'_Aux'!$B$10",
};

function formulasDasAbas() {
  var A = "'_Aux'!";
  var TG = "'Tabela Geral'!";
  var TI = "'Tabela Individual'!";
  var cfg = function (chave) {
    return '=IFERROR(XLOOKUP("' + chave + '",Config!$A$2:$A,Config!$B$2:$B,""),"")';
  };
  // Pedaços reutilizados
  var CRIT = 'FILTER(' + A + '$D$2:$D,' + A + '$D$2:$D<>"")';
  var ROT = 'FILTER(' + A + '$L$2:$L,' + A + '$D$2:$D<>"")';

  var f = [];
  var add = function (aba, celula, formula) { f.push({ aba: aba, celula: celula, formula: formula }); };

  // ---------------- _Aux: parâmetros ----------------
  add(ABAS.AUX, 'B1', '=LET(s,' + TG + '$B$2,IF(OR(s="",s="Todas"),"*",IFERROR(XLOOKUP(s,Config_Etapas!$B$2:$B,Config_Etapas!$A$2:$A),"*")))');
  add(ABAS.AUX, 'B2', '=LET(s,Progresso!$B$2,IFERROR(XLOOKUP(s,Config_Etapas!$B$2:$B,Config_Etapas!$A$2:$A),IFERROR(INDEX(SORT(FILTER(Config_Etapas!$A$2:$A,Config_Etapas!$A$2:$A<>""),FILTER(Config_Etapas!$C$2:$C,Config_Etapas!$A$2:$A<>""),TRUE),1),"geral")))');
  add(ABAS.AUX, 'B3', '=COUNTIF($AI$2:$AI,"?*")');
  add(ABAS.AUX, 'B4', '=COUNTIF($D$2:$D,"?*")');
  add(ABAS.AUX, 'B5', cfg('nota_de_corte'));
  add(ABAS.AUX, 'B6', cfg('vagas'));
  add(ABAS.AUX, 'B7', cfg('min_avaliadores_por_candidato'));
  add(ABAS.AUX, 'B8', cfg('limite_divergencia'));
  add(ABAS.AUX, 'B9', cfg('nome_processo'));
  add(ABAS.AUX, 'B10', '=IFERROR(REGEXEXTRACT(' + TI + '$B$2,"\\(([^()]+)\\)$"),"")');

  // ---------------- _Aux: critérios ativos (critério SIM e bloco SIM), ordenados ----------------
  add(ABAS.AUX, 'D2', '=ARRAYFORMULA(IFERROR(LET(' +
    'id,Config_Criterios!$A$2:$A,bl,Config_Criterios!$B$2:$B,ord,Config_Criterios!$C$2:$C,sg,Config_Criterios!$D$2:$D,' +
    'nm,Config_Criterios!$E$2:$E,ps,Config_Criterios!$G$2:$G,at,Config_Criterios!$H$2:$H,et,Config_Criterios!$I$2:$I,' +
    'blAt,IFERROR(XLOOKUP(bl,Config_Blocos!$A$2:$A,Config_Blocos!$E$2:$E),"NÃO"),' +
    'blOrd,IFERROR(XLOOKUP(bl,Config_Blocos!$A$2:$A,Config_Blocos!$D$2:$D),99),' +
    'blCurto,IFERROR(XLOOKUP(bl,Config_Blocos!$A$2:$A,Config_Blocos!$C$2:$C),bl),' +
    'peso,IF(ISNUMBER(ps),ps,1),' +
    'rot,blCurto&" · "&IF(sg<>"",sg&" ","")&nm,' +
    'ok,(id<>"")*(UPPER(TRIM(at))="SIM")*(UPPER(TRIM(blAt))="SIM"),' +
    'SORT(FILTER(HSTACK(id,bl,peso,sg,nm,blOrd,ord,et,rot),ok),6,TRUE,7,TRUE)),""))');

  // ---------------- _Aux: blocos ativos com algum critério ativo ----------------
  add(ABAS.AUX, 'N2', '=ARRAYFORMULA(IFERROR(SORT(FILTER(HSTACK(Config_Blocos!$A$2:$A,Config_Blocos!$B$2:$B,Config_Blocos!$C$2:$C,Config_Blocos!$D$2:$D),' +
    'Config_Blocos!$A$2:$A<>"",UPPER(TRIM(Config_Blocos!$E$2:$E))="SIM",COUNTIF($E$2:$E,Config_Blocos!$A$2:$A)>0),4,TRUE),""))');

  // ---------------- _Aux: avaliações da etapa selecionada (só critérios ativos) ----------------
  add(ABAS.AUX, 'S2', '=ARRAYFORMULA(IFERROR(FILTER(Avaliacoes!$B$2:$F,Avaliacoes!$B$2:$B<>"",' +
    '($B$1="*")+(Avaliacoes!$B$2:$B=$B$1),ISNUMBER(MATCH(Avaliacoes!$E$2:$E,$D$2:$D,0)),Avaliacoes!$F$2:$F<>""),""))');
  add(ABAS.AUX, 'Y2', '=IFERROR(FILTER($S$2:$W,ISNUMBER($W$2:$W)),"")');

  // ---------------- _Aux: progresso ----------------
  add(ABAS.AUX, 'AI2', '=ARRAYFORMULA(IFERROR(FILTER($D$2:$D,$D$2:$D<>"",($K$2:$K="")+ISNUMBER(SEARCH(","&$B$2&",",","&SUBSTITUTE($K$2:$K," ","")&","))),""))');
  add(ABAS.AUX, 'AE2', '=ARRAYFORMULA(IFERROR(FILTER(Avaliacoes!$C$2:$E,Avaliacoes!$B$2:$B=$B$2,Avaliacoes!$F$2:$F<>"",ISNUMBER(MATCH(Avaliacoes!$E$2:$E,$AI$2:$AI,0))),""))');

  // ---------------- _Aux: listas para dropdowns ----------------
  add(ABAS.AUX, 'AK2', '=ARRAYFORMULA(IFERROR(SORT(FILTER(HSTACK(Candidatos!$A$2:$A,Candidatos!$B$2:$B&" ("&Candidatos!$A$2:$A&")"),Candidatos!$A$2:$A<>""),2,TRUE),""))');
  add(ABAS.AUX, 'AN2', '=VSTACK("Todas",IFERROR(SORT(FILTER(Config_Etapas!$B$2:$B,Config_Etapas!$B$2:$B<>""),FILTER(Config_Etapas!$C$2:$C,Config_Etapas!$B$2:$B<>""),TRUE),""))');
  add(ABAS.AUX, 'AO2', '=IFERROR(SORT(FILTER(Config_Etapas!$B$2:$B,Config_Etapas!$B$2:$B<>""),FILTER(Config_Etapas!$C$2:$C,Config_Etapas!$B$2:$B<>""),TRUE),"")');

  // ---------------- Tabela Geral ----------------
  add(ABAS.GERAL, 'A1', '="Tabela Geral · "&' + AUX.NOME_PROC);
  add(ABAS.GERAL, 'D2', '="Nota de corte: "&IF(' + AUX.CORTE + '="","—",' + AUX.CORTE + ')&"   ·   Vagas: "&IF(' + AUX.VAGAS + '="","—",' + AUX.VAGAS +
    ')&"   ·   Mín. avaliadores: "&' + AUX.MIN_AVAL + '&"   ·   Limite de divergência: "&' + AUX.LIMITE);
  // Linha 3: IDs das colunas (usada pela Tabela Individual e pelo script para conferir os cálculos)
  add(ABAS.GERAL, 'A3', '=ARRAYFORMULA(IFERROR(HSTACK("id","nome","status","ranking","media","situacao","n_avaliadores","desvio","alertas",' +
    'TRANSPOSE("bloco:"&FILTER(' + A + '$N$2:$N,' + A + '$N$2:$N<>"")),TRANSPOSE(' + CRIT + ')),' +
    'HSTACK("id","nome","status","ranking","media","situacao","n_avaliadores","desvio","alertas")))');
  add(ABAS.GERAL, 'A4', '=ARRAYFORMULA(IFERROR(HSTACK("ID","Candidato","Status","Ranking","Média geral","Situação","Nº avaliadores","Desvio padrão","Alertas",' +
    'TRANSPOSE("Média "&FILTER(' + A + '$P$2:$P,' + A + '$N$2:$N<>"")),TRANSPOSE(' + ROT + ')),' +
    'HSTACK("ID","Candidato","Status","Ranking","Média geral","Situação","Nº avaliadores","Desvio padrão","Alertas")))');
  add(ABAS.GERAL, 'A5', '=ARRAYFORMULA(IFERROR(LET(' +
    'ids,FILTER(Candidatos!$A$2:$A,Candidatos!$A$2:$A<>""),' +
    'nomes,XLOOKUP(ids,Candidatos!$A$2:$A,Candidatos!$B$2:$B),' +
    'st,UPPER(TRIM(XLOOKUP(ids,Candidatos!$A$2:$A,Candidatos!$I$2:$I))),' +
    'crit,' + CRIT + ',' +
    'cbT,TRANSPOSE(FILTER(' + A + '$E$2:$E,' + A + '$D$2:$D<>"")),' +
    'w,TRANSPOSE(FILTER(' + A + '$F$2:$F,' + A + '$D$2:$D<>"")),' +
    'bls,FILTER(' + A + '$N$2:$N,' + A + '$N$2:$N<>""),' +
    'bA,' + A + '$Z$2:$Z,bC,' + A + '$AA$2:$AA,bK,' + A + '$AB$2:$AB,bN,' + A + '$AC$2:$AC,' +
    'nC,ROWS(ids),nK,ROWS(crit),nB,ROWS(bls),' +
    'M,MAKEARRAY(nC,nK,LAMBDA(i,j,IFERROR(AVERAGEIFS(bN,bC,INDEX(ids,i),bK,INDEX(crit,j)),""))),' +
    'pond,LAMBDA(lin,pes,LET(num,SUMPRODUCT(IF(ISNUMBER(lin),lin,0)*pes),den,SUMPRODUCT(ISNUMBER(lin)*pes),IF(den=0,"",num/den))),' +
    'MB,MAKEARRAY(nC,nB,LAMBDA(i,j,pond(INDEX(M,i,0),w*(cbT=INDEX(bls,j))))),' +
    'MG,MAKEARRAY(nC,1,LAMBDA(i,j,pond(INDEX(M,i,0),w))),' +
    'NAV,MAP(ids,LAMBDA(c,IFERROR(ROWS(UNIQUE(FILTER(bA,bC=c))),0))),' +
    'DP,MAP(ids,NAV,LAMBDA(c,n,IF(n<2,"",STDEV(MAP(UNIQUE(FILTER(bA,bC=c)),LAMBDA(a,AVERAGEIFS(bN,bC,c,bA,a))))))),' +
    'mR,IF(ISNUMBER(MG),ROUND(MG,9),-1),' +
    'RK,MAP(mR,st,LAMBDA(m,s,IF(AND(s="ATIVO",m>=0),1+SUMPRODUCT((st="ATIVO")*(mR>m)),""))),' +
    'corte,' + AUX.CORTE + ',vagas,' + AUX.VAGAS + ',minA,' + AUX.MIN_AVAL + ',lim,' + AUX.LIMITE + ',' +
    'SIT,MAP(st,MG,RK,LAMBDA(s,m,r,IF(s<>"ATIVO","Fora do ranking",IF(NOT(ISNUMBER(m)),"Sem notas",' +
    'IF(AND(corte="",vagas=""),"",LET(dc,OR(corte="",IFERROR(m>=corte,TRUE)),dv,OR(vagas="",IFERROR(r<=vagas,TRUE)),' +
    'IF(AND(dc,dv),"Classificado",IF(NOT(dc),"Abaixo do corte","Fora das vagas")))))))),' +
    'AL,MAP(NAV,DP,LAMBDA(n,d,TEXTJOIN(" · ",TRUE,IF(AND(ISNUMBER(minA),n<minA),"Dados insuficientes",""),IF(AND(ISNUMBER(d),ISNUMBER(lim),d>lim),"Divergência","")))),' +
    'T,HSTACK(ids,nomes,st,RK,MG,SIT,NAV,DP,AL,MB,M),' +
    'SORT(T,IF(RK="",1000000,RK),TRUE,nomes,TRUE)),' +
    '"Nenhum candidato cadastrado ainda."))');

  // ---------------- Tabela Individual ----------------
  add(ABAS.INDIVIDUAL, 'A1', '="Tabela Individual · "&' + AUX.NOME_PROC);
  add(ABAS.INDIVIDUAL, 'D2', '="Etapa: "&IF(' + TG + '$B$2="","Todas",' + TG + '$B$2)&"  (mude a etapa na Tabela Geral)"');
  add(ABAS.INDIVIDUAL, 'A4', '=IF(' + AUX.CAND_SEL + '="","Escolha um candidato no campo B2.",IFERROR(LET(id,' + AUX.CAND_SEL + ',' +
    'g,LAMBDA(col,XLOOKUP(id,' + TG + '$A$5:$A,INDEX(' + TG + '$A$5:$ZZ,0,MATCH(col,' + TG + '$A$3:$ZZ$3,0)),"")),' +
    'HSTACK("Status: "&g("status"),"Ranking: "&IF(g("ranking")="","—",g("ranking")),"Média: "&IF(ISNUMBER(g("media")),TEXT(g("media"),"0.00"),"—"),' +
    '"Situação: "&g("situacao"),"Avaliadores: "&g("n_avaliadores"),"Alertas: "&IF(g("alertas")="","—",g("alertas")))),"Candidato não encontrado."))');
  // Tabela 1: por critério (A6)
  add(ABAS.INDIVIDUAL, 'A7', '=ARRAYFORMULA(IF(' + AUX.CAND_SEL + '="","",IFERROR(LET(id,' + AUX.CAND_SEL + ',' +
    'crit,' + CRIT + ',' +
    'blc,XLOOKUP(FILTER(' + A + '$E$2:$E,' + A + '$D$2:$D<>""),' + A + '$N$2:$N,' + A + '$P$2:$P,""),' +
    'nm,FILTER(IF(' + A + '$G$2:$G<>"",' + A + '$G$2:$G&" ","")&' + A + '$H$2:$H,' + A + '$D$2:$D<>""),' +
    'mc,MAP(crit,LAMBDA(k,IFERROR(AVERAGEIFS(' + A + '$AC$2:$AC,' + A + '$AA$2:$AA,id,' + A + '$AB$2:$AB,k),""))),' +
    'mg,MAP(crit,LAMBDA(k,IFERROR(AVERAGEIFS(INDEX(' + TG + '$A$5:$ZZ,0,MATCH(k,' + TG + '$A$3:$ZZ$3,0)),' + TG + '$C$5:$C,"ATIVO"),""))),' +
    'dif,MAP(mc,mg,LAMBDA(a,b,IF(AND(ISNUMBER(a),ISNUMBER(b)),a-b,""))),' +
    'nn,MAP(crit,LAMBDA(k,COUNTIFS(' + A + '$AA$2:$AA,id,' + A + '$AB$2:$AB,k))),' +
    'nna,MAP(crit,LAMBDA(k,COUNTIFS(' + A + '$U$2:$U,id,' + A + '$V$2:$V,k,' + A + '$W$2:$W,"NA"))),' +
    'HSTACK(blc,nm,mc,mg,dif,nn,nna)),"")))');
  // Observações (I6)
  add(ABAS.INDIVIDUAL, 'I7', '=ARRAYFORMULA(IF(' + AUX.CAND_SEL + '="","",IFERROR(FILTER(HSTACK(' +
    'XLOOKUP(Observacoes!$B$2:$B,Config_Etapas!$A$2:$A,Config_Etapas!$B$2:$B,Observacoes!$B$2:$B),' +
    'XLOOKUP(Observacoes!$C$2:$C,Avaliadores!$A$2:$A,Avaliadores!$B$2:$B,Observacoes!$C$2:$C),Observacoes!$E$2:$E),' +
    'Observacoes!$D$2:$D=' + AUX.CAND_SEL + ',Observacoes!$E$2:$E<>"",(' + AUX.ETAPA_FILTRO + '="*")+(Observacoes!$B$2:$B=' + AUX.ETAPA_FILTRO + ')),"Sem observações.")))');
  // Matriz avaliador × critério (M6)
  add(ABAS.INDIVIDUAL, 'M6', '=ARRAYFORMULA(IFERROR(HSTACK("Avaliador",TRANSPOSE(' + ROT + ')),"Avaliador"))');
  add(ABAS.INDIVIDUAL, 'M7', '=ARRAYFORMULA(IF(' + AUX.CAND_SEL + '="","",IFERROR(LET(id,' + AUX.CAND_SEL + ',' +
    'crit,' + CRIT + ',' +
    'avs,UNIQUE(FILTER(' + A + '$T$2:$T,' + A + '$U$2:$U=id)),' +
    'nomes,XLOOKUP(avs,Avaliadores!$A$2:$A,Avaliadores!$B$2:$B,avs),' +
    'MX,MAKEARRAY(ROWS(avs),ROWS(crit),LAMBDA(i,j,LET(a,INDEX(avs,i),k,INDEX(crit,j),' +
    'm,IFERROR(AVERAGEIFS(' + A + '$AC$2:$AC,' + A + '$Z$2:$Z,a,' + A + '$AA$2:$AA,id,' + A + '$AB$2:$AB,k),""),' +
    'IF(ISNUMBER(m),m,IF(COUNTIFS(' + A + '$T$2:$T,a,' + A + '$U$2:$U,id,' + A + '$V$2:$V,k,' + A + '$W$2:$W,"NA")>0,"NA",""))))),' +
    'HSTACK(nomes,MX)),"Sem avaliações.")))');

  // ---------------- Progresso ----------------
  add(ABAS.PROGRESSO, 'A1', '="Progresso dos avaliadores · "&' + AUX.NOME_PROC);
  add(ABAS.PROGRESSO, 'D2', '="Critérios nesta etapa: "&' + AUX.N_CRIT_PROG + '&"   ·   Candidatos ativos: "&COUNTIF(Candidatos!$I$2:$I,"ATIVO")');
  add(ABAS.PROGRESSO, 'A5', '=ARRAYFORMULA(IFERROR(LET(' +
    'av,FILTER(Avaliadores!$A$2:$A,Avaliadores!$A$2:$A<>""),' +
    'nm,XLOOKUP(av,Avaliadores!$A$2:$A,Avaliadores!$B$2:$B),' +
    'at,XLOOKUP(av,Avaliadores!$A$2:$A,Avaliadores!$F$2:$F),' +
    'ua,XLOOKUP(av,Avaliadores!$A$2:$A,Avaliadores!$H$2:$H),' +
    'cs,FILTER(Candidatos!$A$2:$A,Candidatos!$A$2:$A<>"",UPPER(TRIM(Candidatos!$I$2:$I))="ATIVO"),' +
    'req,' + AUX.N_CRIT_PROG + ',nc,ROWS(cs),' +
    'MX,MAKEARRAY(ROWS(av),nc,LAMBDA(i,j,COUNTIFS(' + A + '$AE$2:$AE,INDEX(av,i),' + A + '$AF$2:$AF,INDEX(cs,j)))),' +
    'comp,BYROW(MX,LAMBDA(r,SUMPRODUCT((r>=req)*(req>0)))),' +
    'parc,BYROW(MX,LAMBDA(r,SUMPRODUCT((r>0)*((r<req)+(req=0)>0)))),' +
    'pend,nc-comp-parc,' +
    'pct,comp/nc,' +
    'SORT(HSTACK(av,nm,at,comp,parc,pend,pct,ua),7,TRUE,2,TRUE)),' +
    '"Cadastre avaliadores e candidatos ativos para ver o progresso."))');

  // ---------------- Calibracao ----------------
  add(ABAS.CALIBRACAO, 'A1', '="Calibração dos avaliadores · "&' + AUX.NOME_PROC);
  add(ABAS.CALIBRACAO, 'A2', '="Etapa: "&IF(' + TG + '$B$2="","Todas",' + TG + '$B$2)&"  (mude a etapa na Tabela Geral)"');
  add(ABAS.CALIBRACAO, 'A5', '=ARRAYFORMULA(IFERROR(LET(' +
    'av,UNIQUE(FILTER(' + A + '$T$2:$T,' + A + '$T$2:$T<>"")),' +
    'nm,XLOOKUP(av,Avaliadores!$A$2:$A,Avaliadores!$B$2:$B,av),' +
    'mg,AVERAGE(' + A + '$AC$2:$AC),' +
    'md,MAP(av,LAMBDA(a,IFERROR(AVERAGEIFS(' + A + '$AC$2:$AC,' + A + '$Z$2:$Z,a),""))),' +
    'nn,MAP(av,LAMBDA(a,COUNTIFS(' + A + '$Z$2:$Z,a))),' +
    'nna,MAP(av,LAMBDA(a,COUNTIFS(' + A + '$T$2:$T,a,' + A + '$W$2:$W,"NA"))),' +
    'dif,MAP(md,LAMBDA(x,IF(ISNUMBER(x),x-mg,""))),' +
    'SORT(HSTACK(nm,md,MAP(av,LAMBDA(a,mg)),dif,nn,nna,nna/(nn+nna)),4,FALSE)),' +
    '"Sem avaliações nesta etapa."))');
  add(ABAS.CALIBRACAO, 'J5', '=ARRAYFORMULA(IFERROR(LET(' +
    'crit,' + CRIT + ',rot,' + ROT + ',' +
    'D,MAKEARRAY(ROWS(crit),6,LAMBDA(i,j,COUNTIFS(' + A + '$V$2:$V,INDEX(crit,i),' + A + '$W$2:$W,IF(j=6,"NA",j)))),' +
    'tot,BYROW(D,LAMBDA(r,SUM(r))),' +
    'med,MAP(crit,LAMBDA(k,IFERROR(AVERAGEIFS(' + A + '$AC$2:$AC,' + A + '$AB$2:$AB,k),""))),' +
    'HSTACK(rot,D,tot,med)),"Sem avaliações nesta etapa."))');

  return f;
}

/** Textos fixos (rótulos e cabeçalhos) das abas de cálculo. */
function rotulosDasAbas() {
  var r = [];
  var add = function (aba, celula, valores) { r.push({ aba: aba, celula: celula, valores: valores }); };
  add(ABAS.AUX, 'A1', [['etapa_filtro'], ['etapa_progresso'], ['n_crit_progresso'], ['n_crit_ativos'], ['nota_de_corte'],
    ['vagas'], ['min_avaliadores'], ['limite_divergencia'], ['nome_processo'], ['candidato_individual']]);
  add(ABAS.AUX, 'D1', [['crit_id', 'bloco_id', 'peso', 'sigla', 'nome', 'ordem_bloco', 'ordem', 'etapas', 'rotulo']]);
  add(ABAS.AUX, 'N1', [['bloco_id', 'bloco_nome', 'bloco_curto', 'ordem']]);
  add(ABAS.AUX, 'S1', [['etapa', 'avaliador_id', 'candidato_id', 'criterio_id', 'nota']]);
  add(ABAS.AUX, 'Y1', [['etapa', 'avaliador_id', 'candidato_id', 'criterio_id', 'nota_num']]);
  add(ABAS.AUX, 'AE1', [['avaliador_id', 'candidato_id', 'criterio_id']]);
  add(ABAS.AUX, 'AI1', [['crit_progresso']]);
  add(ABAS.AUX, 'AK1', [['cand_id', 'rotulo']]);
  add(ABAS.AUX, 'AN1', [['etapas_com_todas', 'etapas']]);

  add(ABAS.GERAL, 'A2', [['Etapa:']]);
  add(ABAS.INDIVIDUAL, 'A2', [['Candidato:']]);
  add(ABAS.INDIVIDUAL, 'A6', [['Bloco', 'Critério', 'Média do candidato', 'Média do grupo', 'Diferença', 'Nº notas', 'Nº "não posso avaliar"']]);
  add(ABAS.INDIVIDUAL, 'I6', [['Etapa', 'Avaliador', 'Observação']]);
  add(ABAS.PROGRESSO, 'A2', [['Etapa:']]);
  add(ABAS.PROGRESSO, 'A4', [['ID', 'Avaliador', 'Ativo', 'Completos', 'Parciais', 'Pendentes', '% concluído', 'Último acesso']]);
  add(ABAS.CALIBRACAO, 'A4', [['Avaliador', 'Média dada', 'Média geral', 'Diferença', 'Nº notas', 'Nº "não posso avaliar"', '% "não posso avaliar"']]);
  add(ABAS.CALIBRACAO, 'J4', [['Critério', 'Nota 1', 'Nota 2', 'Nota 3', 'Nota 4', 'Nota 5', 'Não posso avaliar', 'Total', 'Média']]);
  return r;
}

/** Células com lista suspensa: [aba, célula, intervalo de origem, valor inicial]. */
function dropdownsDasAbas() {
  return [
    [ABAS.GERAL, 'B2', "'_Aux'!$AN$2:$AN", 'Todas'],
    [ABAS.PROGRESSO, 'B2', "'_Aux'!$AO$2:$AO", 'Geral'],
    [ABAS.INDIVIDUAL, 'B2', "'_Aux'!$AL$2:$AL", ''],
  ];
}
