import { useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  Flag,
  Layers3,
  MessageSquareText,
  NotebookPen,
  Search,
  Star,
  XCircle,
} from 'lucide-react'

const QUESTOES = [
  {
    id: 'SA-001',
    numero: 1,
    disciplina: 'Português',
    assunto: 'Interpretação e finalidade textual',
    topicos: ['Informações explícitas e implícitas', 'Finalidade do texto'],
    meta: 'Edital 71/2026 · IBAM · Prefeitura de Santos · Oficial de Administração · 10 questões · peso 2',
    apoio: 'Base: Anexo II',
    enunciado: 'Em um comunicado interno que informa novo procedimento de protocolo, a finalidade principal do texto é:',
    alternativas: [
      ['A', 'narrar uma experiência pessoal do servidor responsável.'],
      ['B', 'orientar os destinatários sobre uma rotina administrativa.'],
      ['C', 'convencer o leitor a aderir a uma opinião política.'],
      ['D', 'descrever literariamente o ambiente de trabalho.'],
    ],
    resposta: 'B',
    comentario: 'Comunicados administrativos têm finalidade informativa e orientadora. No contexto do edital, gêneros como comunicados, memorandos e instruções aparecem ligados à comunicação administrativa clara e objetiva.',
  },
  {
    id: 'SA-002',
    numero: 2,
    disciplina: 'Português',
    assunto: 'Coesão e conectivos',
    topicos: ['Relações de oposição', 'Reescrita com manutenção do sentido'],
    meta: 'Edital 71/2026 · Língua Portuguesa · peso 2',
    apoio: 'Treino de reescrita',
    enunciado: 'Assinale a alternativa que mantém o sentido de oposição em: "O atendimento foi rápido, mas o cadastro ficou incompleto."',
    alternativas: [
      ['A', 'O atendimento foi rápido, portanto o cadastro ficou incompleto.'],
      ['B', 'Embora o atendimento tenha sido rápido, o cadastro ficou incompleto.'],
      ['C', 'O atendimento foi rápido porque o cadastro ficou incompleto.'],
      ['D', 'O cadastro ficou incompleto a fim de que o atendimento fosse rápido.'],
    ],
    resposta: 'B',
    comentario: '"Embora" preserva a ideia concessiva/opositiva indicada por "mas".',
  },
  {
    id: 'SA-003',
    numero: 3,
    disciplina: 'Português',
    assunto: 'Crase e regência',
    topicos: ['Regência verbal', 'Crase'],
    meta: 'Edital 71/2026 · Língua Portuguesa · peso 2',
    apoio: 'Gramática aplicada',
    enunciado: 'Assinale a frase em que o uso da crase está correto.',
    alternativas: [
      ['A', 'O servidor entregou o documento à chefia responsável.'],
      ['B', 'O servidor anexou à formulário ao processo.'],
      ['C', 'A equipe analisou à solicitação recebida.'],
      ['D', 'O protocolo encaminhou à todos os documentos.'],
    ],
    resposta: 'A',
    comentario: 'Há crase em "à chefia" porque ocorre a preposição "a" exigida pelo verbo e o artigo "a" antes de substantivo feminino. Nas demais, há uso indevido.',
  },
  {
    id: 'SA-004',
    numero: 4,
    disciplina: 'Português',
    assunto: 'Concordância',
    topicos: ['Concordância verbal', 'Norma-padrão'],
    meta: 'Edital 71/2026 · Língua Portuguesa · peso 2',
    apoio: 'Gramática aplicada',
    enunciado: 'Assinale a alternativa em conformidade com a concordância verbal.',
    alternativas: [
      ['A', 'Houveram muitos pedidos pendentes no setor.'],
      ['B', 'Fazem dois dias que o processo chegou.'],
      ['C', 'Existem documentos anexados ao processo.'],
      ['D', 'Segue anexo as certidões solicitadas.'],
    ],
    resposta: 'C',
    comentario: 'O verbo "existir" concorda com o sujeito plural: "documentos". "Haver" no sentido de existir e "fazer" indicando tempo ficam no singular.',
  },
  {
    id: 'SA-005',
    numero: 5,
    disciplina: 'Matemática',
    assunto: 'Porcentagem',
    topicos: ['Acréscimos e descontos simples', 'Situações administrativas'],
    meta: 'Edital 71/2026 · Matemática · 6 questões · peso 2',
    apoio: 'Cálculo rápido',
    enunciado: 'Um lote de 240 formulários teve 15% de documentos devolvidos por preenchimento incompleto. Quantos formulários foram devolvidos?',
    alternativas: [
      ['A', '24'],
      ['B', '30'],
      ['C', '36'],
      ['D', '40'],
    ],
    resposta: 'C',
    comentario: '15% de 240 = 0,15 x 240 = 36.',
  },
  {
    id: 'SA-006',
    numero: 6,
    disciplina: 'Matemática',
    assunto: 'Regra de três',
    topicos: ['Proporção', 'Rotina administrativa'],
    meta: 'Edital 71/2026 · Matemática · peso 2',
    apoio: 'Cálculo rápido',
    enunciado: 'Se 3 servidores conferem 90 processos em um dia, mantendo o mesmo ritmo, 5 servidores conferem quantos processos no mesmo período?',
    alternativas: [
      ['A', '120'],
      ['B', '135'],
      ['C', '150'],
      ['D', '180'],
    ],
    resposta: 'C',
    comentario: '90 processos divididos por 3 servidores = 30 por servidor. Com 5 servidores: 5 x 30 = 150.',
  },
  {
    id: 'SA-007',
    numero: 7,
    disciplina: 'Matemática',
    assunto: 'Média aritmética',
    topicos: ['Organização de dados', 'Média simples'],
    meta: 'Edital 71/2026 · Matemática · peso 2',
    apoio: 'Cálculo rápido',
    enunciado: 'Um setor registrou 12, 18, 15 e 19 atendimentos em quatro períodos. A média simples de atendimentos foi:',
    alternativas: [
      ['A', '14'],
      ['B', '15'],
      ['C', '16'],
      ['D', '17'],
    ],
    resposta: 'C',
    comentario: '12 + 18 + 15 + 19 = 64. Dividindo por 4, a média é 16.',
  },
  {
    id: 'SA-008',
    numero: 8,
    disciplina: 'Legislação Municipal e Serviço Público',
    assunto: 'Princípios da Administração Pública',
    topicos: ['Legalidade', 'Impessoalidade', 'Moralidade', 'Publicidade', 'Eficiência'],
    meta: 'Edital 71/2026 · Legislação e Serviço Público · 8 questões · peso 2',
    apoio: 'Revisão essencial',
    enunciado: 'A atuação do servidor que atende o cidadão com respeito, sem favorecimentos pessoais e seguindo as normas internas está principalmente ligada aos princípios de:',
    alternativas: [
      ['A', 'legalidade, impessoalidade e urbanidade.'],
      ['B', 'informalidade, pessoalidade e sigilo absoluto.'],
      ['C', 'preferência pessoal, rapidez e improviso.'],
      ['D', 'hierarquia privada, pessoalidade e publicidade seletiva.'],
    ],
    resposta: 'A',
    comentario: 'O edital cobra princípios da Administração e conduta do servidor. Respeitar normas, não favorecer pessoas e tratar bem o usuário combina legalidade, impessoalidade e urbanidade.',
  },
  {
    id: 'SA-009',
    numero: 9,
    disciplina: 'Legislação Municipal e Serviço Público',
    assunto: 'Lei de Acesso à Informação',
    topicos: ['Publicidade como regra', 'Sigilo como exceção', 'Informações pessoais'],
    meta: 'Edital 71/2026 · Lei nº 12.527/2011 · peso 2',
    apoio: 'Lei citada no edital',
    enunciado: 'De acordo com a lógica da Lei de Acesso à Informação, assinale a alternativa correta.',
    alternativas: [
      ['A', 'O sigilo é a regra geral para todos os documentos públicos.'],
      ['B', 'A publicidade é a regra, e o sigilo é exceção nos casos previstos.'],
      ['C', 'Pedidos de informação podem ser ignorados quando feitos por cidadão comum.'],
      ['D', 'Informações pessoais devem ser divulgadas livremente em qualquer hipótese.'],
    ],
    resposta: 'B',
    comentario: 'O edital destaca publicidade como regra, sigilo como exceção, transparência ativa e passiva e proteção de informações pessoais.',
  },
  {
    id: 'SA-010',
    numero: 10,
    disciplina: 'Legislação Municipal e Serviço Público',
    assunto: 'LGPD',
    topicos: ['Dados pessoais', 'Finalidade', 'Necessidade', 'Segurança'],
    meta: 'Edital 71/2026 · Lei nº 13.709/2018 · peso 2',
    apoio: 'Lei citada no edital',
    enunciado: 'Ao registrar dados de usuários em sistema administrativo, a conduta mais adequada é:',
    alternativas: [
      ['A', 'coletar todos os dados possíveis, ainda que desnecessários.'],
      ['B', 'compartilhar a senha do sistema com colegas para acelerar o atendimento.'],
      ['C', 'registrar apenas dados necessários, com finalidade definida e cuidado de segurança.'],
      ['D', 'enviar planilhas com dados pessoais por qualquer canal, sem controle.'],
    ],
    resposta: 'C',
    comentario: 'A LGPD exige finalidade, adequação, necessidade, segurança, prevenção e cuidado no registro e compartilhamento de dados.',
  },
  {
    id: 'SA-011',
    numero: 11,
    disciplina: 'Legislação Municipal e Serviço Público',
    assunto: 'Atendimento prioritário',
    topicos: ['Lei nº 10.048/2000', 'Atendimento diferenciado'],
    meta: 'Edital 71/2026 · Atendimento prioritário · peso 2',
    apoio: 'Lei citada no edital',
    enunciado: 'Conforme o conteúdo previsto no edital, o atendimento prioritário alcança, entre outros grupos:',
    alternativas: [
      ['A', 'apenas servidores públicos municipais.'],
      ['B', 'pessoas com deficiência, pessoas idosas, gestantes, lactantes, pessoas com criança de colo e pessoas obesas.'],
      ['C', 'somente candidatos aprovados em concurso público.'],
      ['D', 'apenas usuários que apresentem requerimento por escrito.'],
    ],
    resposta: 'B',
    comentario: 'A Lei nº 10.048/2000 aparece no edital com esses grupos e com a ideia de atendimento diferenciado e imediato.',
  },
  {
    id: 'SA-012',
    numero: 12,
    disciplina: 'Informática e Rotinas Administrativas',
    assunto: 'Segurança da informação',
    topicos: ['Senhas', 'Phishing', 'Cópias de segurança'],
    meta: 'Edital 71/2026 · Informática e Rotinas Administrativas · 6 questões · peso 2',
    apoio: 'Rotina real de setor',
    enunciado: 'Uma mensagem informa que a conta institucional será bloqueada e pede que o servidor clique em um link desconhecido para confirmar sua senha. A conduta mais segura é:',
    alternativas: [
      ['A', 'clicar imediatamente, pois mensagens urgentes sempre são verdadeiras.'],
      ['B', 'responder com a senha para comprovar identidade.'],
      ['C', 'desconfiar da mensagem, não clicar no link e verificar pelos canais oficiais.'],
      ['D', 'encaminhar a mensagem a todos os usuários para que confiram também.'],
    ],
    resposta: 'C',
    comentario: 'O edital cobra cuidados com links, anexos e mensagens suspeitas, além de senhas, malware e phishing.',
  },
  {
    id: 'SA-013',
    numero: 13,
    disciplina: 'Informática e Rotinas Administrativas',
    assunto: 'Planilhas eletrônicas',
    topicos: ['Fórmulas básicas', 'Soma', 'Média', 'Filtros'],
    meta: 'Edital 71/2026 · Informática e Rotinas Administrativas · peso 2',
    apoio: 'Planilhas',
    enunciado: 'Em uma planilha, para obter automaticamente a soma dos valores de A1 até A10, usa-se, em geral, a fórmula:',
    alternativas: [
      ['A', '=SOMA(A1:A10)'],
      ['B', '=MEDIA(A1:A10)'],
      ['C', '=MINIMO(A1:A10)'],
      ['D', '=TEXTO(A1:A10)'],
    ],
    resposta: 'A',
    comentario: 'O edital cobra fórmulas básicas em planilhas, como soma, média, mínimo, máximo e porcentagem.',
  },
  {
    id: 'SA-014',
    numero: 14,
    disciplina: 'Informática e Rotinas Administrativas',
    assunto: 'Protocolo e tramitação',
    topicos: ['Autuação', 'Juntada', 'Controle e arquivamento'],
    meta: 'Edital 71/2026 · Rotinas Administrativas · peso 2',
    apoio: 'Rotina administrativa',
    enunciado: 'Em rotinas de protocolo, a juntada corresponde, em regra, ao ato de:',
    alternativas: [
      ['A', 'eliminar documentos antes da análise.'],
      ['B', 'inserir documento ou peça aos autos de um processo.'],
      ['C', 'alterar o número de todos os processos antigos.'],
      ['D', 'impedir a tramitação do processo sem registro.'],
    ],
    resposta: 'B',
    comentario: 'O edital cita protocolo, autuação, juntada, tramitação, distribuição, controle e arquivamento de documentos e processos.',
  },
  {
    id: 'SA-015',
    numero: 15,
    disciplina: 'Conhecimentos Específicos',
    assunto: 'Atribuições do Oficial de Administração',
    topicos: ['Recebimento', 'Registro', 'Distribuição', 'Controle', 'Arquivamento'],
    meta: 'Edital 71/2026 · Conhecimentos Específicos · 10 questões · peso 4',
    apoio: 'Prioridade alta',
    enunciado: 'Segundo as atribuições do cargo, é atividade compatível com o Oficial de Administração:',
    alternativas: [
      ['A', 'realizar perícia médica admissional.'],
      ['B', 'julgar recursos administrativos como autoridade máxima.'],
      ['C', 'receber, registrar, controlar e arquivar processos, documentos e correspondências.'],
      ['D', 'criar leis municipais sem tramitação legislativa.'],
    ],
    resposta: 'C',
    comentario: 'O Anexo I e o conteúdo específico destacam tarefas de rotina administrativa, incluindo recebimento, registro, informação, distribuição, controle e arquivamento.',
  },
  {
    id: 'SA-016',
    numero: 16,
    disciplina: 'Conhecimentos Específicos',
    assunto: 'Gestão documental',
    topicos: ['Arquivos correntes', 'Intermediários', 'Permanentes'],
    meta: 'Edital 71/2026 · Conhecimentos Específicos · peso 4',
    apoio: 'Prioridade alta',
    enunciado: 'Arquivos correntes são, em regra, aqueles:',
    alternativas: [
      ['A', 'eliminados logo após o recebimento.'],
      ['B', 'consultados com frequência e necessários às atividades em andamento.'],
      ['C', 'sem valor administrativo ou histórico.'],
      ['D', 'guardados apenas por valor histórico, sem uso administrativo.'],
    ],
    resposta: 'B',
    comentario: 'A gestão documental do edital envolve arquivos correntes, intermediários e permanentes. Correntes são os mais usados na rotina ativa.',
  },
  {
    id: 'SA-017',
    numero: 17,
    disciplina: 'Conhecimentos Específicos',
    assunto: 'Atendimento ao público',
    topicos: ['Urbanidade', 'Orientação objetiva', 'Registro de demandas'],
    meta: 'Edital 71/2026 · Conhecimentos Específicos · peso 4',
    apoio: 'Prioridade alta',
    enunciado: 'No atendimento ao público, a conduta mais adequada do servidor é:',
    alternativas: [
      ['A', 'prestar orientação objetiva, registrar a demanda e encaminhar ao setor competente quando necessário.'],
      ['B', 'evitar registrar reclamações para reduzir estatísticas negativas.'],
      ['C', 'usar linguagem informal e ambígua para abreviar o atendimento.'],
      ['D', 'tratar usuários de forma diferente conforme preferência pessoal.'],
    ],
    resposta: 'A',
    comentario: 'O edital cobra atendimento presencial, telefônico e eletrônico, orientação objetiva, registro de demandas e urbanidade.',
  },
  {
    id: 'SA-018',
    numero: 18,
    disciplina: 'Conhecimentos Específicos',
    assunto: 'Redação oficial',
    topicos: ['Impessoalidade', 'Clareza', 'Concisão', 'Formalidade'],
    meta: 'Edital 71/2026 · Conhecimentos Específicos · peso 4',
    apoio: 'Prioridade alta',
    enunciado: 'Em uma comunicação administrativa simples, são qualidades desejáveis:',
    alternativas: [
      ['A', 'excesso de opinião pessoal, linguagem vaga e informalidade.'],
      ['B', 'impessoalidade, clareza, concisão, formalidade e correção gramatical.'],
      ['C', 'uso de gírias, abreviações não padronizadas e ironia.'],
      ['D', 'omissão de informações essenciais para preservar a brevidade.'],
    ],
    resposta: 'B',
    comentario: 'O edital cita expressamente impessoalidade, clareza, concisão, formalidade, padronização e correção gramatical.',
  },
  {
    id: 'SA-019',
    numero: 19,
    disciplina: 'Conhecimentos Específicos',
    assunto: 'Almoxarifado e materiais',
    topicos: ['Solicitação', 'Recebimento', 'Guarda', 'Controle de estoque'],
    meta: 'Edital 71/2026 · Conhecimentos Específicos · peso 4',
    apoio: 'Prioridade alta',
    enunciado: 'No controle de materiais de expediente, uma prática adequada é:',
    alternativas: [
      ['A', 'registrar entradas e saídas para acompanhar estoque e necessidade de reposição.'],
      ['B', 'dispensar conferência de quantidade quando o fornecedor for conhecido.'],
      ['C', 'guardar produtos sem identificação para economizar tempo.'],
      ['D', 'solicitar materiais sem demanda ou justificativa.'],
    ],
    resposta: 'A',
    comentario: 'O edital cobra solicitação, recebimento, guarda, distribuição e controle de estoque de materiais.',
  },
  {
    id: 'SA-020',
    numero: 20,
    disciplina: 'Conhecimentos Específicos',
    assunto: 'Patrimônio público',
    topicos: ['Identificação', 'Uso', 'Guarda', 'Conservação'],
    meta: 'Edital 71/2026 · Conhecimentos Específicos · peso 4',
    apoio: 'Prioridade alta',
    enunciado: 'Em relação aos bens patrimoniais, cabe à rotina administrativa apoiar:',
    alternativas: [
      ['A', 'o uso sem registro para facilitar a circulação dos bens.'],
      ['B', 'a identificação, guarda, conservação e controle dos bens públicos.'],
      ['C', 'a transferência informal de equipamentos sem comunicação.'],
      ['D', 'o descarte de bens permanentes sem procedimento.'],
    ],
    resposta: 'B',
    comentario: 'O edital inclui patrimônio público, identificação, uso, guarda, conservação e controle de bens patrimoniais.',
  },
  {
    id: 'SA-021',
    numero: 21,
    disciplina: 'Conhecimentos Específicos',
    assunto: 'Compras públicas e contratos',
    topicos: ['Lei nº 14.133/2021', 'Requisição', 'Recebimento', 'Prazos'],
    meta: 'Edital 71/2026 · Conhecimentos Específicos · peso 4',
    apoio: 'Prioridade alta',
    enunciado: 'Nas rotinas administrativas ligadas a compras públicas, o servidor de apoio deve:',
    alternativas: [
      ['A', 'conferir documentos, quantidades, especificações e acompanhar prazos pertinentes.'],
      ['B', 'substituir a licitação por acordo verbal sempre que houver urgência.'],
      ['C', 'ignorar notas e documentos após o recebimento do produto.'],
      ['D', 'aprovar pagamentos sem qualquer conferência documental.'],
    ],
    resposta: 'A',
    comentario: 'O edital cobra noções da Lei nº 14.133/2021 aplicadas a requisição, recebimento, conferência, guarda de documentos, prazos e apoio à execução contratual.',
  },
  {
    id: 'SA-022',
    numero: 22,
    disciplina: 'Conhecimentos Específicos',
    assunto: 'Processos administrativos',
    topicos: ['Instrução processual', 'Conferência de documentos', 'Formalização'],
    meta: 'Edital 71/2026 · Conhecimentos Específicos · peso 4',
    apoio: 'Prioridade alta',
    enunciado: 'A instrução processual básica envolve, entre outras ações:',
    alternativas: [
      ['A', 'retirar documentos obrigatórios para reduzir o volume do processo.'],
      ['B', 'conferir documentos necessários, organizar informações e registrar atos pertinentes.'],
      ['C', 'manter processos sem numeração para preservar sigilo.'],
      ['D', 'decidir o mérito de todos os casos sem encaminhamento à chefia.'],
    ],
    resposta: 'B',
    comentario: 'O conteúdo específico menciona organização de documentos para instrução de processos, conferência de documentos obrigatórios e formalização de atos simples.',
  },
  {
    id: 'SA-023',
    numero: 23,
    disciplina: 'Conhecimentos Específicos',
    assunto: 'Sigilo e proteção de dados',
    topicos: ['Informações administrativas', 'Discrição', 'Responsabilidade'],
    meta: 'Edital 71/2026 · Conhecimentos Específicos · peso 4',
    apoio: 'Prioridade alta',
    enunciado: 'Ao lidar com processo que contém dados pessoais de usuários, o servidor deve:',
    alternativas: [
      ['A', 'divulgar os dados em grupos de mensagem para facilitar o atendimento.'],
      ['B', 'permitir consulta irrestrita a qualquer pessoa, sem controle.'],
      ['C', 'manter sigilo, registrar e compartilhar informações apenas conforme necessidade e autorização.'],
      ['D', 'copiar os dados para arquivos pessoais, sem finalidade administrativa.'],
    ],
    resposta: 'C',
    comentario: 'O edital cobra proteção de dados pessoais, sigilo de informações administrativas, responsabilidade e discrição.',
  },
  {
    id: 'SA-024',
    numero: 24,
    disciplina: 'Conhecimentos Específicos',
    assunto: 'Postura profissional',
    topicos: ['Assiduidade', 'Pontualidade', 'Hierarquia', 'Trabalho em equipe'],
    meta: 'Edital 71/2026 · Conhecimentos Específicos · peso 4',
    apoio: 'Prioridade alta',
    enunciado: 'Assinale a alternativa que melhor representa postura profissional esperada no serviço público.',
    alternativas: [
      ['A', 'Pontualidade, urbanidade, zelo por documentos e cooperação com a equipe.'],
      ['B', 'Improviso permanente, descuido com prazos e preferência pessoal.'],
      ['C', 'Recusa sistemática de ordens de serviço regulares.'],
      ['D', 'Uso particular de equipamentos e informações públicas.'],
    ],
    resposta: 'A',
    comentario: 'O edital destaca urbanidade, assiduidade, pontualidade, responsabilidade, ética, trabalho em equipe, hierarquia, disciplina e zelo por bens públicos.',
  },
  {
    id: 'SA-025',
    numero: 25,
    disciplina: 'Redação',
    assunto: 'Resposta administrativa',
    topicos: ['20 a 30 linhas', 'Sem título', 'Demanda prática'],
    meta: 'Edital 71/2026 · Redação · 40 pontos · mínimo 20',
    apoio: 'Treino de redação',
    enunciado: 'Na prova de redação, segundo o edital, a resposta definitiva deve:',
    alternativas: [
      ['A', 'conter título obrigatório e no máximo 15 linhas.'],
      ['B', 'ter no mínimo 20 e no máximo 30 linhas, sem necessidade de título.'],
      ['C', 'ser escrita em tópicos soltos, sem articulação verbal.'],
      ['D', 'apresentar assinatura para identificação do candidato.'],
    ],
    resposta: 'B',
    comentario: 'O edital prevê redação de 20 a 30 linhas, sem título. Título, se inserido, conta como linha e não é considerado para avaliação.',
  },
  {
    id: 'SA-026',
    numero: 26,
    disciplina: 'Redação',
    assunto: 'Critérios de correção',
    topicos: ['Conteúdo', 'Providências administrativas', 'Norma-padrão'],
    meta: 'Edital 71/2026 · Redação · 40 pontos',
    apoio: 'Treino de redação',
    enunciado: 'Na redação, vale mais ponto no edital:',
    alternativas: [
      ['A', 'conteúdo, adequação à demanda administrativa e desenvolvimento da resposta.'],
      ['B', 'uso de título criativo e linguagem literária.'],
      ['C', 'quantidade de citações externas sem relação com o caso.'],
      ['D', 'assinatura e identificação pessoal ao final.'],
    ],
    resposta: 'A',
    comentario: 'O edital atribui 25 pontos ao conteúdo/adequação à demanda administrativa e 15 pontos ao domínio da escrita formal.',
  },
]

const FILTROS = [
  'Todas',
  'Interpretação e finalidade textual',
  'Coesão e conectivos',
  'Crase e regência',
  'Concordância',
  'Porcentagem',
  'Regra de três',
  'Média aritmética',
  'Princípios da Administração Pública',
  'Lei de Acesso à Informação',
  'LGPD',
  'Atendimento prioritário',
  'Segurança da informação',
  'Planilhas eletrônicas',
  'Protocolo e tramitação',
  'Atribuições do Oficial de Administração',
  'Gestão documental',
  'Atendimento ao público',
  'Redação oficial',
  'Almoxarifado e materiais',
  'Patrimônio público',
  'Compras públicas e contratos',
  'Processos administrativos',
  'Sigilo e proteção de dados',
  'Postura profissional',
  'Resposta administrativa',
  'Critérios de correção',
]

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function MiniStat({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-950',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
  }

  return (
    <div className={`rounded-md border p-3 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
        <Icon size={16} />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  )
}

export default function ConcursosStudy() {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('Todas')
  const [indice, setIndice] = useState(0)
  const [respostas, setRespostas] = useState({})
  const [conferidas, setConferidas] = useState({})
  const [favoritas, setFavoritas] = useState({})
  const [anotacoes, setAnotacoes] = useState({})

  const questoes = useMemo(() => {
    const termo = normalizar(busca)
    return QUESTOES.filter((questao) => {
      const conteudo = normalizar(`${questao.id} ${questao.disciplina} ${questao.assunto} ${questao.enunciado} ${questao.topicos.join(' ')}`)
      return (!termo || conteudo.includes(termo)) && (filtro === 'Todas' || questao.assunto === filtro)
    })
  }, [busca, filtro])

  const questao = questoes[Math.min(indice, Math.max(questoes.length - 1, 0))]
  const respondidas = Object.keys(respostas).length
  const acertos = Object.entries(conferidas).filter(([id]) => respostas[id] === QUESTOES.find((item) => item.id === id)?.resposta).length
  const aproveitamento = respondidas ? Math.round((acertos / respondidas) * 100) : 0

  function selecionarQuestao(proximoIndice) {
    setIndice(proximoIndice)
  }

  function responder(letra) {
    if (!questao) return
    setRespostas((atual) => ({ ...atual, [questao.id]: letra }))
  }

  function conferir() {
    if (!questao || !respostas[questao.id]) return
    setConferidas((atual) => ({ ...atual, [questao.id]: true }))
  }

  function limparResposta() {
    if (!questao) return
    setRespostas((atual) => {
      const novo = { ...atual }
      delete novo[questao.id]
      return novo
    })
    setConferidas((atual) => {
      const novo = { ...atual }
      delete novo[questao.id]
      return novo
    })
  }

  const marcada = questao ? respostas[questao.id] : null
  const conferida = questao ? conferidas[questao.id] : false
  const correta = conferida && marcada === questao.resposta

  return (
    <div className="min-h-screen bg-[#eef2f5] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#0f172a] text-white">
              <ClipboardList size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-6">Reta Final - Questões do Edital</h1>
              <p className="text-sm text-slate-500">Prefeitura de Santos - SP · IBAM · Oficial de Administração · faltam 9 dias</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
            <MiniStat icon={FileQuestion} label="Questões" value={questoes.length} />
            <MiniStat icon={CheckCircle2} label="Acertos" value={acertos} tone="green" />
            <MiniStat icon={BarChart3} label="Aproveit." value={`${aproveitamento}%`} tone="blue" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
              <Flag size={17} />
              Plano de 9 dias
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-950">
              Faça 3 blocos por dia: específicos, legislação e português/matemática. Conhecimentos Específicos vale peso 4, então ele puxa sua nota.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-amber-950">
              <div className="rounded border border-amber-200 bg-white/70 p-2">Objetiva: 40 questões</div>
              <div className="rounded border border-amber-200 bg-white/70 p-2">Duração: 4 horas</div>
              <div className="rounded border border-amber-200 bg-white/70 p-2">Mínimo: 50 pontos</div>
              <div className="rounded border border-amber-200 bg-white/70 p-2">Redação: 20 a 30 linhas</div>
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Search size={17} />
              Buscar questões
            </div>
            <input
              value={busca}
              onChange={(event) => {
                setBusca(event.target.value)
                setIndice(0)
              }}
              className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-500"
              placeholder="ID, assunto ou enunciado"
            />
            <label className="mt-4 block text-xs font-bold uppercase text-slate-500">
              Assunto
              <select
                value={filtro}
                onChange={(event) => {
                  setFiltro(event.target.value)
                  setIndice(0)
                }}
                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal normal-case text-slate-900 outline-none focus:border-slate-500"
              >
                {FILTROS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </section>

          <section className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Layers3 size={17} />
                Lista da prova
              </div>
              <p className="mt-1 text-sm text-slate-500">{respondidas} respondidas de {QUESTOES.length}</p>
            </div>
            <div className="max-h-[520px] overflow-auto p-2">
              {questoes.map((item, itemIndice) => {
                const ativa = item.id === questao?.id
                const itemConferido = conferidas[item.id]
                const itemCorreto = itemConferido && respostas[item.id] === item.resposta
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selecionarQuestao(itemIndice)}
                    className={`mb-2 w-full rounded-md border p-3 text-left transition ${ativa ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{item.numero}. {item.id}</span>
                      {favoritas[item.id] && <Star size={15} className="fill-amber-400 text-amber-400" />}
                    </div>
                    <div className={`mt-1 text-xs ${ativa ? 'text-slate-200' : 'text-slate-500'}`}>{item.assunto}</div>
                    {itemConferido && (
                      <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${itemCorreto ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                        {itemCorreto ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {itemCorreto ? 'Certa' : 'Revisar'}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        </aside>

        {questao ? (
          <section className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{questao.disciplina}</span>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800">{questao.assunto}</span>
                    {questao.apoio && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{questao.apoio}</span>}
                  </div>
                  <h2 className="mt-3 text-lg font-bold leading-7">Questão {questao.numero} · {questao.id}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{questao.meta}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFavoritas((atual) => ({ ...atual, [questao.id]: !atual[questao.id] }))}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold ${favoritas[questao.id] ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  <Star size={16} className={favoritas[questao.id] ? 'fill-amber-400 text-amber-400' : ''} />
                  Caderno
                </button>
              </div>
            </div>

            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="p-5">
                <p className="text-base leading-7 text-slate-900">{questao.enunciado}</p>

                <div className="mt-5 space-y-3">
                  {questao.alternativas.map(([letra, texto]) => {
                    const selecionada = marcada === letra
                    const respostaCerta = conferida && questao.resposta === letra
                    const respostaErrada = conferida && selecionada && questao.resposta !== letra
                    return (
                      <button
                        key={letra}
                        type="button"
                        onClick={() => responder(letra)}
                        className={`flex w-full items-start gap-3 rounded-md border p-4 text-left transition ${
                          respostaCerta
                            ? 'border-emerald-300 bg-emerald-50'
                            : respostaErrada
                              ? 'border-red-300 bg-red-50'
                              : selecionada
                                ? 'border-slate-900 bg-slate-50'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm font-bold ${
                          respostaCerta
                            ? 'border-emerald-500 bg-emerald-600 text-white'
                            : respostaErrada
                              ? 'border-red-500 bg-red-600 text-white'
                              : selecionada
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-700'
                        }`}>
                          {letra}
                        </span>
                        <span className="pt-1 text-sm leading-6 text-slate-800">{texto}</span>
                      </button>
                    )
                  })}
                </div>

                {conferida && (
                  <div className={`mt-5 rounded-md border p-4 ${correta ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-center gap-2 font-bold">
                      {correta ? <CheckCircle2 size={18} className="text-emerald-700" /> : <XCircle size={18} className="text-red-700" />}
                      {correta ? 'Resposta correta' : `Resposta correta: ${questao.resposta}`}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{questao.comentario}</p>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={conferir}
                      disabled={!marcada}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} />
                      Conferir resposta
                    </button>
                    <button type="button" onClick={limparResposta} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      Limpar
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => selecionarQuestao(Math.max(indice - 1, 0))}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <ChevronLeft size={16} />
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => selecionarQuestao(Math.min(indice + 1, questoes.length - 1))}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Próxima
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <aside className="border-t border-slate-200 bg-slate-50 p-4 xl:border-l xl:border-t-0">
                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <BookOpen size={16} />
                    Tópicos
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {questao.topicos.map((topico) => (
                      <span key={topico} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{topico}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <NotebookPen size={16} />
                    Minhas anotações
                  </div>
                  <textarea
                    value={anotacoes[questao.id] || ''}
                    onChange={(event) => setAnotacoes((atual) => ({ ...atual, [questao.id]: event.target.value }))}
                    className="mt-3 min-h-32 w-full resize-y rounded-md border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-slate-500"
                    placeholder="Escreva uma regra, dica ou erro comum para revisar depois."
                  />
                </div>

                <div className="mt-4 grid gap-3">
                  <button type="button" className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <MessageSquareText size={16} />
                    Comentários
                  </button>
                  <button type="button" className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <Flag size={16} />
                    Notificar erro
                  </button>
                </div>
              </aside>
            </div>
          </section>
        ) : (
          <section className="flex min-h-[420px] items-center justify-center rounded-md border border-slate-200 bg-white p-8 text-center">
            <div>
              <FileQuestion size={34} className="mx-auto text-slate-400" />
              <h2 className="mt-3 text-lg font-bold">Nenhuma questão encontrada</h2>
              <p className="mt-1 text-sm text-slate-500">Limpe a busca ou altere o assunto selecionado.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
