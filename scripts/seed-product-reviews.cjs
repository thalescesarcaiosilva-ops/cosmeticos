/**
 * Regenera avaliações com 8 estruturas (5 por produto, estruturas distintas).
 * Nomes por gênero/categoria + textos adaptados sem cruzar temas.
 *
 * Uso: node --env-file=.env.local scripts/seed-product-reviews.cjs
 */
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const FEMALE_FIRST = [
  'Ana', 'Beatriz', 'Camila', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena',
  'Isabela', 'Juliana', 'Larissa', 'Mariana', 'Natália', 'Patrícia', 'Rafaela', 'Sabrina',
  'Tatiane', 'Vanessa', 'Amanda', 'Bruna', 'Carolina', 'Débora', 'Elaine', 'Fabiana',
  'Giovana', 'Jéssica', 'Karen', 'Letícia', 'Mônica', 'Priscila', 'Renata', 'Simone',
  'Thaís', 'Viviane', 'Aline', 'Bianca', 'Cláudia', 'Denise', 'Érica', 'Flávia',
  'Ingrid', 'Joana', 'Kelly', 'Luciana', 'Márcia', 'Nicole', 'Olivia', 'Paula',
  'Roberta', 'Sandra', 'Tereza', 'Valéria', 'Yasmin', 'Lorena', 'Marina', 'Sofia',
  'Lívia', 'Helena', 'Manuela', 'Isadora',
]

const MALE_FIRST = [
  'Carlos', 'Diego', 'Eduardo', 'Felipe', 'Gustavo', 'Henrique', 'Igor', 'João',
  'Lucas', 'Marcelo', 'Nicolas', 'Otávio', 'Pedro', 'Rafael', 'Sérgio', 'Thiago',
  'André', 'Bruno', 'Caio', 'Daniel', 'Fábio', 'Guilherme', 'Hugo', 'Ivan',
  'José', 'Leandro', 'Mateus', 'Paulo', 'Ricardo', 'Rodrigo', 'Samuel', 'Vinícius',
  'Alexandre', 'Bernardo', 'César', 'Davi', 'Fernando', 'Gabriel', 'Heitor', 'Murilo',
]

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira',
  'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes',
  'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Moreira', 'Nunes',
  'Mendes', 'Cardoso', 'Teixeira', 'Batista', 'Campos', 'Freitas', 'Araújo', 'Melo',
]

/**
 * 8 estruturas × várias paráfrases por categoria.
 * Evita cruzar temas (ex.: maquiagem em perfume).
 */
const STRUCTURES = {
  // 1 RESULTADO RÁPIDO
  1: {
    maquiagem: [
      'Adorei! Notei diferença na aplicação já nos primeiros dias. Já pensei em comprar de novo!',
      'O acabamento apareceu logo. Mudança visível desde o começo. Voltaria a comprar com certeza.',
      'Que produto bom! Senti o efeito rápido no rosto. Recomendo demais!',
      'Funciona bem desde o primeiro uso. Estou muito satisfeita. Excelente!',
      'Resultado rápido! Não esperava gostar tanto assim. Muito bom!',
    ],
    'perfumes-femininos': [
      'Adorei! Senti a fragrância bem desde a primeira borrifada. Já quero repetir!',
      'Fixou rápido na pele. Mudança clara no meu dia a dia. Voltaria a comprar com certeza.',
      'Que fragrância boa! Gostei logo de cara. Recomendo demais!',
      'Funciona bem desde o começo. Estou muito satisfeita. Excelente!',
      'Resultado rápido na fixação! Não esperava agradar tanto. Muito bom!',
    ],
    'perfumes-masculinos': [
      'Gostei bastante! Senti a fragrância bem desde a primeira aplicação. Já penso em repetir!',
      'Fixou rápido na pele. Diferença clara no uso diário. Voltaria a comprar com certeza.',
      'Fragrância boa! Aprovei logo no primeiro dia. Recomendo!',
      'Funciona bem desde o começo. Estou muito satisfeito. Excelente!',
      'Resultado rápido na fixação! Não esperava gostar tanto. Muito bom!',
    ],
    dermocosmeticos: [
      'Adorei! Notei melhora na primeira semana de uso. Já comprei novamente!',
      'Realmente funciona rápido. Mudança visível desde os primeiros dias. Voltaria a comprar com certeza.',
      'Que produto maravilhoso! Senti diferença logo. Recomendo demais!',
      'Funciona mesmo desde o começo. Estou muito satisfeito. Excelente!',
      'Resultado rápido e eficiente! Não esperava melhorar tão rápido assim. Muito bom!',
    ],
    'protecao-solar': [
      'Adorei! A textura agradou já no primeiro uso. Já penso em comprar de novo!',
      'Funciona bem desde o começo. Fácil de espalhar e confortável. Voltaria a comprar.',
      'Que produto bom! Senti diferença na rotina logo. Recomendo!',
      'Uso desde o primeiro dia sem problema. Estou satisfeito. Excelente!',
      'Resultado rápido na rotina! Não esperava ser tão prático. Muito bom!',
    ],
    'cuidados-capilares': [
      'Adorei! Notei o cabelo melhor já nas primeiras lavagens. Já quero repetir!',
      'Funciona rápido. Diferença visível depois de poucos usos. Voltaria a comprar.',
      'Que produto bom! Senti diferença logo. Recomendo demais!',
      'Funciona bem desde o começo. Estou satisfeita. Excelente!',
      'Resultado rápido! Não esperava melhorar tão cedo. Muito bom!',
    ],
    default: [
      'Adorei! Notei melhora na primeira semana de uso. Já comprei novamente!',
      'Realmente funciona rápido. Mudança visível desde o primeiro dia. Voltaria a comprar com certeza.',
      'Que produto maravilhoso! Senti diferença logo. Recomendo demais!',
      'Funciona mesmo desde o começo. Estou muito satisfeito. Excelente!',
      'Resultado rápido e eficiente! Não esperava melhorar tão rápido assim. Muito bom!',
    ],
  },
  // 2 CUSTO-BENEFÍCIO
  2: {
    maquiagem: [
      'Ótima qualidade e o valor é justo. Meu novo favorito!',
      'Excelente custo-benefício, não esperava tanta qualidade. Vale cada centavo.',
      'O preço é acessível e a qualidade é boa. Muito satisfeita com a compra.',
      'Surpreendente a relação qualidade e preço. Superou minhas expectativas!',
      'Melhor investimento que fiz nessa categoria. A qualidade compensa. Recomendo!',
    ],
    'perfumes-femininos': [
      'Ótima fragrância e o valor é justo. Meu novo favorito!',
      'Excelente custo-benefício, não esperava tanta qualidade. Vale cada centavo.',
      'O preço é acessível e a fixação é boa. Muito satisfeita com a compra.',
      'Surpreendente a relação qualidade e preço. Superou minhas expectativas!',
      'Bom investimento. A qualidade da fragrância compensa. Recomendo!',
    ],
    'perfumes-masculinos': [
      'Ótima qualidade e o valor é justo. Virou meu favorito!',
      'Excelente custo-benefício, não esperava tanta qualidade. Vale cada centavo.',
      'O preço é acessível e a fixação é boa. Muito satisfeito com a compra.',
      'Surpreendente a relação qualidade e preço. Superou minhas expectativas!',
      'Bom investimento. A qualidade da fragrância compensa. Recomendo!',
    ],
    dermocosmeticos: [
      'Ótima qualidade e o valor é justo. Meu novo favorito!',
      'Excelente custo-benefício, não esperava tanta qualidade. Vale cada centavo investido.',
      'O preço é acessível e a qualidade é excepcional. Muito satisfeito com a compra.',
      'Surpreendente a relação qualidade e preço. Superou minhas expectativas!',
      'Melhor investimento que fiz. A qualidade compensa o preço. Recomendo!',
    ],
    'protecao-solar': [
      'Ótima qualidade e o valor é justo. Entrou na rotina!',
      'Excelente custo-benefício, não esperava tanta qualidade. Vale cada centavo.',
      'O preço é acessível e a textura é boa. Muito satisfeito com a compra.',
      'Surpreendente a relação qualidade e preço. Superou minhas expectativas!',
      'Bom investimento para o dia a dia. A qualidade compensa. Recomendo!',
    ],
    'cuidados-capilares': [
      'Ótima qualidade e o valor é justo. Meu novo favorito!',
      'Excelente custo-benefício, não esperava tanta qualidade. Vale cada centavo.',
      'O preço é acessível e o cabelo respondeu bem. Muito satisfeita.',
      'Surpreendente a relação qualidade e preço. Superou minhas expectativas!',
      'Bom investimento. A qualidade compensa o preço. Recomendo!',
    ],
    default: [
      'Ótima qualidade e o valor é justo. Meu novo favorito!',
      'Excelente custo-benefício, não esperava tanta qualidade. Vale cada centavo investido.',
      'O preço é acessível e a qualidade é excepcional. Muito satisfeito com a compra.',
      'Surpreendente a relação qualidade e preço. Superou minhas expectativas!',
      'Melhor investimento que fiz. A qualidade compensa o preço. Recomendo!',
    ],
  },
  // 3 EXPECTATIVA VS REALIDADE
  3: {
    maquiagem: [
      'Imaginava algo bom, mas superou expectativas. Recomendo!',
      'Melhor do que esperava pela descrição. Muito satisfeita.',
      'Achava que era bom, mas ficou ainda melhor. Adorei!',
      'Não sabia bem o que esperar, mas impressionou mesmo. Voltaria a comprar!',
      'Esperava pouco, recebi muito. Produto top demais!',
    ],
    'perfumes-femininos': [
      'Imaginava algo bom, mas a fragrância superou. Recomendo!',
      'Melhor do que esperava pela descrição. Muito satisfeita.',
      'Achava que era bom, mas ficou ainda melhor. Adorei!',
      'Não sabia bem o que esperar, mas impressionou. Voltaria a comprar!',
      'Esperava pouco, recebi muito. Fragrância top!',
    ],
    'perfumes-masculinos': [
      'Imaginava algo bom, mas a fragrância superou. Recomendo!',
      'Melhor do que esperava pela descrição. Muito satisfeito.',
      'Achava que era bom, mas ficou ainda melhor. Gostei!',
      'Não sabia bem o que esperar, mas impressionou. Voltaria a comprar!',
      'Esperava pouco, recebi muito. Fragrância top!',
    ],
    dermocosmeticos: [
      'Imaginava algo bom, mas superou expectativas. Recomendo!',
      'Melhor do que esperava pela descrição. Muito satisfeito.',
      'Achava que era bom, mas ficou ainda melhor. Adorei!',
      'Não sabia bem o que esperar, mas impressionante mesmo. Voltaria a comprar!',
      'Esperava pouco, recebi muito. Produto top demais!',
    ],
    'protecao-solar': [
      'Imaginava algo bom, mas superou expectativas. Recomendo!',
      'Melhor do que esperava pela descrição. Muito satisfeito.',
      'Achava que era bom, mas ficou ainda melhor. Gostei!',
      'Não sabia bem o que esperar, mas impressionou. Voltaria a comprar!',
      'Esperava pouco, recebi muito. Produto top!',
    ],
    'cuidados-capilares': [
      'Imaginava algo bom, mas superou expectativas. Recomendo!',
      'Melhor do que esperava pela descrição. Muito satisfeita.',
      'Achava que era bom, mas ficou ainda melhor. Adorei!',
      'Não sabia bem o que esperar, mas impressionou. Voltaria a comprar!',
      'Esperava pouco, recebi muito. Produto top demais!',
    ],
    default: [
      'Imaginava algo bom, mas superou expectativas. Recomendo!',
      'Melhor do que esperava pela descrição. Muito satisfeito.',
      'Achava que era bom, mas ficou ainda melhor. Adorei!',
      'Não sabia bem o que esperar, mas impressionante mesmo. Voltaria a comprar!',
      'Esperava pouco, recebi muito. Produto top demais!',
    ],
  },
  // 4 REPETIÇÃO DE COMPRA
  4: {
    maquiagem: [
      'Gostei muito! Voltaria a comprar com certeza. Produto confiável.',
      'Não sabia o que esperar, mas voltei a comprar. Vale a pena!',
      'Já é minha segunda compra. Fidelidade garantida. Muito bom!',
      'Amei tanto que já pedi de novo. Qualidade boa!',
      'A primeira compra foi sucesso, agora é item fixo. Sempre repito!',
    ],
    'perfumes-femininos': [
      'Gostei muito! Voltaria a comprar com certeza. Fragrância confiável.',
      'Não sabia o que esperar, mas voltei a comprar. Vale a pena!',
      'Já é minha segunda compra. Fidelidade garantida. Muito bom!',
      'Amei tanto que já pedi de novo. Qualidade boa!',
      'A primeira compra foi sucesso, agora é favorita. Sempre repito!',
    ],
    'perfumes-masculinos': [
      'Gostei muito! Voltaria a comprar com certeza. Produto confiável.',
      'Não sabia o que esperar, mas voltei a comprar. Vale a pena!',
      'Já é minha segunda compra. Fidelidade garantida. Muito bom!',
      'Gostei tanto que já pedi de novo. Qualidade boa!',
      'A primeira compra foi sucesso, agora é favorito. Sempre repito!',
    ],
    dermocosmeticos: [
      'Gostei muito! Voltaria a comprar com certeza. Produto confiável.',
      'Não sabia o que esperar, mas voltei a comprar. Vale a pena!',
      'Já é minha terceira compra. Fidelidade garantida. Muito bom!',
      'Amei tanto que já comprei duas vezes mais. Produto de qualidade!',
      'A primeira compra foi sucesso, agora é meu produto favorito. Sempre repito!',
    ],
    'protecao-solar': [
      'Gostei muito! Voltaria a comprar com certeza. Produto confiável.',
      'Não sabia o que esperar, mas voltei a comprar. Vale a pena!',
      'Já é minha segunda compra. Fidelidade garantida. Muito bom!',
      'Gostei tanto que já pedi de novo. Qualidade boa!',
      'A primeira compra foi sucesso, agora é item fixo. Sempre repito!',
    ],
    'cuidados-capilares': [
      'Gostei muito! Voltaria a comprar com certeza. Produto confiável.',
      'Não sabia o que esperar, mas voltei a comprar. Vale a pena!',
      'Já é minha terceira compra. Fidelidade garantida. Muito bom!',
      'Amei tanto que já comprei de novo. Produto de qualidade!',
      'A primeira compra foi sucesso, agora é favorito. Sempre repito!',
    ],
    default: [
      'Gostei muito! Voltaria a comprar com certeza. Produto confiável.',
      'Não sabia o que esperar, mas voltei a comprar. Vale a pena!',
      'Já é minha terceira compra. Fidelidade garantida. Muito bom!',
      'Amei tanto que já comprei duas vezes mais. Produto de qualidade!',
      'A primeira compra foi sucesso, agora é meu produto favorito. Sempre repito!',
    ],
  },
  // 5 PROBLEMA RESOLVIDO (adaptado por categoria)
  5: {
    maquiagem: [
      'Tinha dificuldade de cobertura, agora o acabamento ficou uniforme. Simples e eficaz!',
      'O rosto marcava fácil, agora dura melhor ao longo do dia. Produto excepcional!',
      'Sofria com acabamento irregular, melhorou bastante. Maravilhoso!',
      'Tinha problema com aspecto pesado, agora fica leve. Muito feliz!',
      'A pigmentação melhorou minha rotina. Resultado real e visível. Recomendo!',
    ],
    'perfumes-femininos': [
      'Tinha fragrâncias que enjoavam rápido, essa permanece agradável. Simples e eficaz!',
      'Sofria com fixação fraca, agora dura bem mais. Produto excepcional!',
      'Projeção demais me incomodava, essa é equilibrada. Maravilhoso!',
      'Tinha dificuldade de achar cheiro limpo, agora encontrei. Muito feliz!',
      'A fixação resolveu meu problema do dia a dia. Resultado real. Recomendo!',
    ],
    'perfumes-masculinos': [
      'Tinha fragrâncias que enjoavam rápido, essa permanece agradável. Simples e eficaz!',
      'Sofria com fixação fraca, agora dura bem mais. Produto excepcional!',
      'Projeção demais me incomodava, essa é equilibrada. Muito bom!',
      'Tinha dificuldade de achar cheiro limpo, agora encontrei. Satisfeito!',
      'A fixação resolveu meu problema do dia a dia. Resultado real. Recomendo!',
    ],
    dermocosmeticos: [
      'Tinha ressecamento, agora a pele está hidratada. Simples e eficaz!',
      'A pele ficava desconfortável, agora está mais macia. Produto excepcional!',
      'Sofria com sensação de ressecamento, melhorou em poucos dias. Maravilhoso!',
      'Tinha problemas de sensibilidade, agora nada mais. Muito feliz!',
      'A textura irregular diminuiu bastante. Resultado real e visível. Recomendo!',
    ],
    'protecao-solar': [
      'Tinha dificuldade com textura pesada, agora fica leve. Simples e eficaz!',
      'Esbranquiçava fácil, agora espalha sem esse problema. Produto excepcional!',
      'Sofria com oleosidade no meio do dia, melhorou. Muito bom!',
      'Tinha sensibilidade, agora uso sem desconforto. Satisfeito!',
      'A aplicação irregular diminuiu. Resultado prático no dia a dia. Recomendo!',
    ],
    'cuidados-capilares': [
      'Tinha ressecamento, agora o cabelo está mais macio. Simples e eficaz!',
      'Meu cabelo era frágil, agora está mais forte e com brilho. Produto excepcional!',
      'Sofria com frizz, diminuiu em poucos usos. Maravilhoso!',
      'Tinha dificuldade de desembaraçar, agora ficou mais fácil. Muito feliz!',
      'O aspecto opaco melhorou bastante. Resultado real e visível. Recomendo!',
    ],
    default: [
      'Tinha um problema recorrente, agora melhorou. Simples e eficaz!',
      'O que me incomodava diminuiu bastante. Produto excepcional!',
      'Sofria com isso, melhorou em poucos dias. Maravilhoso!',
      'Tinha dificuldade no dia a dia, agora ficou mais fácil. Muito feliz!',
      'O resultado apareceu de forma clara. Recomendo!',
    ],
  },
  // 6 COMPARAÇÃO IMPLÍCITA
  6: {
    maquiagem: [
      'Melhor que outras marcas que já usei. Qualidade garantida.',
      'Já testei várias, essa é a melhor mesmo. Vale investir.',
      'Comparado com o que usava antes, essa é superior. Muito bom!',
      'Entre os produtos similares, esse é destaque. Diferença notável!',
      'Não volto mais para outra opção. Esse tem ótimo custo-benefício.',
    ],
    'perfumes-femininos': [
      'Melhor que outras fragrâncias que já usei. Qualidade garantida.',
      'Já testei várias, essa é a melhor mesmo. Vale investir.',
      'Comparado com o que usava antes, essa é superior. Muito bom!',
      'Entre fragrâncias parecidas, essa se destaca. Diferença notável!',
      'Não volto mais para outra. Esse tem ótimo custo-benefício.',
    ],
    'perfumes-masculinos': [
      'Melhor que outras fragrâncias que já usei. Qualidade garantida.',
      'Já testei várias, essa é a melhor mesmo. Vale investir.',
      'Comparado com o que usava antes, essa é superior. Muito bom!',
      'Entre fragrâncias parecidas, essa se destaca. Diferença notável!',
      'Não volto mais para outra. Esse tem ótimo custo-benefício.',
    ],
    dermocosmeticos: [
      'Melhor que outras marcas que já usei. Qualidade garantida.',
      'Já testei várias, essa é a melhor mesmo. Vale investir.',
      'Comparado com o que usava antes, essa é superior. Muito bom!',
      'Entre os produtos similares, esse é destaque. Diferença notável!',
      'Não volta mais para outra marca. Esse é o melhor custo-benefício.',
    ],
    'protecao-solar': [
      'Melhor que outros que já usei. Qualidade garantida.',
      'Já testei vários, esse é o melhor mesmo. Vale investir.',
      'Comparado com o que usava antes, esse é superior. Muito bom!',
      'Entre opções parecidas, esse se destaca. Diferença notável!',
      'Não volto mais para outro. Esse tem ótimo custo-benefício.',
    ],
    'cuidados-capilares': [
      'Melhor que outras marcas que já usei. Qualidade garantida.',
      'Já testei várias, essa é a melhor mesmo. Vale investir.',
      'Comparado com o que usava antes, essa é superior. Muito bom!',
      'Entre os produtos similares, esse é destaque. Diferença notável!',
      'Não volto mais para outra marca. Esse tem ótimo custo-benefício.',
    ],
    default: [
      'Melhor que outras marcas que já usei. Qualidade garantida.',
      'Já testei várias, essa é a melhor mesmo. Vale investir.',
      'Comparado com o que usava antes, essa é superior. Muito bom!',
      'Entre os produtos similares, esse é destaque. Diferença notável!',
      'Não volta mais para outra marca. Esse é o melhor custo-benefício.',
    ],
  },
  // 7 SIMPLICIDADE E EFICÁCIA
  7: {
    maquiagem: [
      'Simples e muito eficaz. Recomendo!',
      'Funciona como promete. Satisfeita com a compra.',
      'Prático, rápido e funciona mesmo. Que produto bom!',
      'Sem complicação, só resultado. Perfeito!',
      'Fácil de usar e super eficiente. Muito bom mesmo!',
    ],
    'perfumes-femininos': [
      'Simples e muito eficaz. Recomendo!',
      'Funciona como promete. Satisfeita com a compra.',
      'Prático e a fragrância funciona bem. Que produto bom!',
      'Sem complicação, só resultado. Perfeito!',
      'Fácil de usar e eficiente. Muito bom mesmo!',
    ],
    'perfumes-masculinos': [
      'Simples e muito eficaz. Recomendo!',
      'Funciona como promete. Satisfeito com a compra.',
      'Prático e a fragrância funciona bem. Que produto bom!',
      'Sem complicação, só resultado. Perfeito!',
      'Fácil de usar e eficiente. Muito bom mesmo!',
    ],
    dermocosmeticos: [
      'Simples e muito eficaz. Recomendo!',
      'Funciona como promete. Satisfeito com a compra.',
      'Prático, rápido e funciona mesmo. Que produto bom!',
      'Sem complicação, só resultado. Perfeito!',
      'Fácil de usar e super eficiente. Muito bom mesmo!',
    ],
    'protecao-solar': [
      'Simples e muito eficaz. Recomendo!',
      'Funciona como promete. Satisfeito com a compra.',
      'Prático, rápido e funciona mesmo. Que produto bom!',
      'Sem complicação, só resultado. Perfeito!',
      'Fácil de usar e super eficiente. Muito bom mesmo!',
    ],
    'cuidados-capilares': [
      'Simples e muito eficaz. Recomendo!',
      'Funciona como promete. Satisfeita com a compra.',
      'Prático, rápido e funciona mesmo. Que produto bom!',
      'Sem complicação, só resultado. Perfeito!',
      'Fácil de usar e super eficiente. Muito bom mesmo!',
    ],
    default: [
      'Simples e muito eficaz. Recomendo!',
      'Funciona como promete. Satisfeito com a compra.',
      'Prático, rápido e funciona mesmo. Que produto bom!',
      'Sem complicação, só resultado. Perfeito!',
      'Fácil de usar e super eficiente. Muito bom mesmo!',
    ],
  },
  // 8 DETALHE + CONCLUSÃO
  8: {
    maquiagem: [
      'A sensação ao aplicar é agradável. Adorei o resultado. Produto top!',
      'Rende bem e dura bastante. Muito bom mesmo. Voltaria a comprar.',
      'A textura é boa e o acabamento agrada. Ficou perfeito!',
      'Não mancha e espalha fácil. Resultado excepcional. Recomendo!',
      'Fica uniforme e leve no rosto. Estou muito satisfeita!',
    ],
    'perfumes-femininos': [
      'A sensação ao usar é agradável. Adorei o resultado. Produto top!',
      'Rende bem e a fixação dura. Muito bom mesmo. Voltaria a comprar.',
      'A saída é boa e o aroma agrada. Ficou perfeito!',
      'Não irrita e fixa bem. Resultado excepcional. Recomendo!',
      'Cheiro limpo e agradável. Estou muito satisfeita!',
    ],
    'perfumes-masculinos': [
      'A sensação ao usar é agradável. Gostei do resultado. Produto top!',
      'Rende bem e a fixação dura. Muito bom mesmo. Voltaria a comprar.',
      'A saída é boa e o aroma agrada. Ficou excelente!',
      'Não irrita e fixa bem. Resultado excepcional. Recomendo!',
      'Cheiro limpo e agradável. Estou muito satisfeito!',
    ],
    dermocosmeticos: [
      'A sensação ao usar é agradável. Adorei o resultado. Produto top!',
      'Rende bem e dura bastante. Muito bom mesmo. Voltaria a comprar.',
      'A textura é boa e o acabamento agrada. Ficou perfeito!',
      'Não mancha e absorve rápido. Resultado excepcional. Recomendo!',
      'Deixa a pele confortável. Estou muito satisfeito!',
    ],
    'protecao-solar': [
      'A sensação ao usar é agradável. Gostei do resultado. Produto top!',
      'Rende bem e dura bastante. Muito bom mesmo. Voltaria a comprar.',
      'A textura é boa e espalha fácil. Ficou perfeito!',
      'Não esbranquiça e absorve rápido. Resultado excepcional. Recomendo!',
      'Fica leve na pele. Estou muito satisfeito!',
    ],
    'cuidados-capilares': [
      'A sensação ao usar é agradável. Adorei o resultado. Produto top!',
      'Rende bem e dura bastante. Muito bom mesmo. Voltaria a comprar.',
      'A textura é boa e o cheiro agrada. Ficou perfeito!',
      'Não pesa e o cabelo fica macio. Resultado excepcional. Recomendo!',
      'Deixa os fios com aspecto saudável. Estou muito satisfeita!',
    ],
    default: [
      'A sensação ao usar é agradável. Adorei o resultado. Produto top!',
      'Rende bem e dura bastante. Muito bom mesmo. Voltaria a comprar.',
      'A textura é boa e o aroma agrada. Ficou perfeito!',
      'Não mancha e absorve rápido. Resultado excepcional. Recomendo!',
      'Uso fácil e resultado claro. Estou muito satisfeito!',
    ],
  },
}

function rnd(n) {
  return crypto.randomInt(n)
}

function pick(arr) {
  return arr[rnd(arr.length)]
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function genderForCategory(slug) {
  if (slug === 'maquiagem' || slug === 'perfumes-femininos') return 'female'
  if (slug === 'perfumes-masculinos') return 'male'
  return 'mixed'
}

function authorName(gender) {
  const resolved =
    gender === 'female' || gender === 'male'
      ? gender
      : rnd(2) === 0
        ? 'female'
        : 'male'
  const pool = resolved === 'female' ? FEMALE_FIRST : MALE_FIRST
  const first = pick(pool)
  const last = pick(LAST_NAMES)
  const mode = rnd(10)
  const name =
    mode < 4 ? first : mode < 7 ? `${first} ${last}` : `${first} ${last[0]}.`
  return { name, gender: resolved }
}

/** Ajusta concordância (satisfeito/satisfeita) ao gênero do autor. */
function agreeComment(text, gender) {
  if (gender === 'female') {
    return text.replace(/\bsatisfeito\b/gi, (m) =>
      m[0] === 'S' ? 'Satisfeita' : 'satisfeita'
    )
  }
  return text.replace(/\bsatisfeita\b/gi, (m) =>
    m[0] === 'S' ? 'Satisfeito' : 'satisfeito'
  )
}

function emailFromName(name) {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.')
  const domains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br']
  return `${base || 'cliente'}${crypto.randomInt(1000, 9999)}@${pick(domains)}`
}

function commentFor(structureId, categorySlug, used) {
  const byStruct = STRUCTURES[structureId]
  const pool = byStruct[categorySlug] || byStruct.default
  for (let i = 0; i < 20; i++) {
    const text = pick(pool)
    if (!used.has(text)) {
      used.add(text)
      return text
    }
  }
  const text = pick(pool)
  used.add(text)
  return text
}

function buildRatings(count) {
  const target = 4.7 + Math.random() * 0.3
  const maxFours = Math.max(0, Math.floor(count * 0.3))
  let fours = Math.min(maxFours, Math.round((5 - target) * count))
  fours = Math.max(0, Math.min(maxFours, fours))
  return shuffle(Array(count - fours).fill(5).concat(Array(fours).fill(4)))
}

function randomPastDate(daysBack = 180) {
  const offset = crypto.randomInt(daysBack * 24 * 60 * 60 * 1000)
  return new Date(Date.now() - offset).toISOString()
}

function primaryCategory(product) {
  const pcs = product.product_categories || []
  for (const pc of pcs) {
    const c = Array.isArray(pc.categories) ? pc.categories[0] : pc.categories
    if (c?.slug) return c.slug
  }
  return 'default'
}

async function fetchAllProducts() {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from('products')
      .select('id, name, slug, product_categories(categories(slug))')
      .eq('active', true)
      .range(from, from + 199)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 200) break
    from += 200
  }
  return rows
}

async function clearReviews() {
  for (;;) {
    const { data, error } = await sb.from('product_reviews').select('id').limit(500)
    if (error) throw error
    if (!data?.length) break
    const { error: delErr } = await sb
      .from('product_reviews')
      .delete()
      .in(
        'id',
        data.map((r) => r.id)
      )
    if (delErr) throw delErr
  }
}

async function main() {
  console.log('Limpando avaliações antigas…')
  await clearReviews()

  const products = await fetchAllProducts()
  console.log('products', products.length)

  const allRows = []
  const structureIds = [1, 2, 3, 4, 5, 6, 7, 8]

  const countHistogram = {}

  for (const product of products) {
    const cat = primaryCategory(product)
    const gender = genderForCategory(cat)
    // 5 a 15 avaliações por produto
    const reviewCount = 5 + rnd(11)
    countHistogram[reviewCount] = (countHistogram[reviewCount] || 0) + 1

    // Garante estruturas distintas primeiro; depois completa com aleatórias
    const primary = shuffle(structureIds)
    const chosen = []
    for (let i = 0; i < reviewCount; i++) {
      if (i < primary.length) chosen.push(primary[i])
      else chosen.push(structureIds[rnd(structureIds.length)])
    }

    const ratings = buildRatings(reviewCount)
    const namesUsed = new Set()
    const commentsUsed = new Set()

    for (let i = 0; i < reviewCount; i++) {
      let author = authorName(gender)
      let guard = 0
      while (namesUsed.has(author.name) && guard < 20) {
        author = authorName(gender)
        guard++
      }
      namesUsed.add(author.name)

      const created = randomPastDate(200)
      allRows.push({
        product_id: product.id,
        author_name: author.name,
        author_email: emailFromName(author.name),
        rating: ratings[i],
        title: null,
        comment: agreeComment(
          commentFor(chosen[i], cat, commentsUsed),
          author.gender
        ),
        status: 'approved',
        approved: true,
        imported_from_csv: true,
        approved_at: created,
        approved_by: null,
        created_at: created,
        updated_at: created,
      })
    }
  }

  console.log('reviews per product distribution', countHistogram)

  console.log('reviews to insert', allRows.length)

  let inserted = 0
  for (let i = 0; i < allRows.length; i += 200) {
    const chunk = allRows.slice(i, i + 200)
    const { error, data } = await sb.from('product_reviews').insert(chunk).select('id')
    if (error) throw error
    inserted += data?.length || 0
    if ((i / 200) % 3 === 0) console.log(`progress ${inserted}/${allRows.length}`)
  }

  const samples = {}
  for (const slug of [
    'maquiagem',
    'perfumes-femininos',
    'perfumes-masculinos',
    'dermocosmeticos',
    'protecao-solar',
    'cuidados-capilares',
  ]) {
    const prod = products.find((p) => primaryCategory(p) === slug)
    if (!prod) continue
    const { data } = await sb
      .from('product_reviews')
      .select('author_name, comment, rating')
      .eq('product_id', prod.id)
      .eq('approved', true)
      .order('created_at', { ascending: false })
    samples[slug] = data
  }

  const { count: total } = await sb
    .from('product_reviews')
    .select('*', { count: 'exact', head: true })
  const { count: pending } = await sb
    .from('product_reviews')
    .select('*', { count: 'exact', head: true })
    .eq('approved', false)

  console.log(JSON.stringify({ inserted, total, pending, samples }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
