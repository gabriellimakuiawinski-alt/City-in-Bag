# Cidade — Documento de Design do Jogo

Versão viva no Claude Docs: https://claude.ai/artifact/7z5VyeeYQQtPNpwjs1SWBt
Este arquivo é uma cópia atualizada a cada entrega.

## Visão geral

Cidade é um jogo de construção de cidades moderno, offline, para celular e PC, com visual cartunesco 3D e foco em gerenciamento de recursos. Mistura o visual do CityRT, os sistemas do Cities: Skylines e o clima aconchegante do Town to City.

- **Gênero:** construção e gestão de cidade, um jogador, sem modo online.
- **Época:** moderna.
- **Inspirações:** CityRT (visual ilustrado com contorno), Cities: Skylines (zonas, serviços, cadeias), Town to City (decoração, cidade bonita), TheoTown (demanda R/C/I no celular).
- **Pilares:**
  1. Construir é gostoso: arrastar ruas e pintar bairros com resposta imediata.
  2. A cidade é viva: prédios crescem sozinhos conforme a demanda.
  3. Recursos importam: comida e mercadorias passam por cadeias de produção.
  4. Bonito por padrão: qualquer cidade fica com cara de ilustração.

## Tecnologia e plataforma

O protótipo roda no navegador com Three.js, o que permite testar no celular e no PC pelo mesmo link. A decisão é web por enquanto e Godot se o jogo crescer além do que o navegador aguenta.

- **Motor:** Three.js 0.170 (WebGL), arquivos `index.html`, `game.js` e `models.js`.
- **Modo:** offline, um jogador. Save automático no navegador a cada 15 s e ao sair.
- **Desempenho:** prédios agrupados em blocos de 8×8 lotes num único mesh com contorno.
- **Limite conhecido:** trânsito pesado e metrópoles grandes devem pesar no navegador do celular.
- **Empacotamento futuro:** Capacitor (celular) e Electron ou Tauri (PC), ou migração para Godot.

## Visual e interface

3D low-poly com sombreamento em faixas (toon), contorno marrom em todos os objetos e cores quentes.

- **Fontes:** Lilita One em títulos, números e botões; Baloo 2 nos textos.
- **Ícones:** conjunto próprio em SVG. Nenhum emoji no jogo.
- **HUD:** dinheiro com saldo do dia, população, felicidade, estoque (trigo, alimento, mercadorias), dia, etapa da cidade, meta atual e barras de demanda R C I.
- **Ferramentas por categoria:** Ver; Obras (rua, árvore, demolir); Bairros (casas, comércio, indústria, escritórios); Produção (fazenda, alimentos); Cidade (prefeitura, praça); Marcos.
- **Celular:** um dedo move a câmera no modo Ver; construindo, um dedo constrói e dois dedos movem e dão zoom. Botões para girar.
- **PC:** WASD ou setas, roda do mouse, Q/E para girar, teclas 1 a 9 para ferramentas.

## Mapa, terreno e ruas

- Grade de 48×48 lotes com rio, bosques e uma estrada de entrada.
- **Ruas:** arrastar desenha em L, R$ 10 por trecho. **Pontes:** sobre o rio, R$ 50 por trecho.
- **Árvores:** R$ 10. **Demolir:** retângulo que remove prédios, ruas, fazendas, árvores e zonas.
- **Em aberto:** relevo, ruas curvas livres, tipos de rua.

## Bairros

O jogador pinta zonas (Casas, Comércio, Indústria) e os prédios surgem sozinhos quando há demanda. Cada zona tem densidade comum ou alta; a alta libera na etapa Cidade pequena (1.000 moradores).

- **Crescimento:** um prédio nasce a partir de um lote pintado que encosta na rua e se estende para o fundo conforme o tamanho do modelo.
- **Escolha do modelo:** o jogo sorteia entre os modelos que cabem, com preferência pelos maiores; nas casas, o valor do terreno favorece modelos simples, médios ou de alto padrão.
- **Valor do terreno:** sobe perto de praças, da água e da prefeitura; cai perto de indústria.
- **Catálogo (45 modelos):**
  - Casas comuns: casa térrea, sobrado, chalé, casa com garagem, casa com varanda, casa moderna, casas em fileira, chácara, mansão, condomínio de casas.
  - Casas alta densidade: prédio de tijolos, edifício residencial, prédio clássico, torre residencial, conjunto habitacional, bloco com pátio.
  - Comércio comum: padaria, mercadinho, farmácia, restaurante, loja de roupas, café, sorveteria, lanchonete, galeria de lojas, supermercado, posto de gasolina.
  - Comércio alto: torre de escritórios, banco, hotel, loja de departamentos, prédio misto, shopping.
  - Indústria comum: galpão, oficina, depósito, marcenaria, serralheria.
  - Indústria alta: fábrica, tanques, armazém logístico, usina.

## Tamanhos dos prédios

- De 1×1 até 4×4, incluindo retângulos (1×2, 2×3, 2×4, 4×3…). Marcos podem passar disso.
- **Capacidade:** cresce com a área e com os andares.
- **Altura:** casas de 1 a 2 andares, prédios altos de 4 a 12, torres de escritórios até 15.
- **Casa pequena ou mansão:** depende da etapa, do valor do terreno e (Entrega B) da classe social que se muda.
- **Limite por etapa:** 2×2 na Vila, 3×3 na Cidade pequena, 12 lotes na Cidade, 4×4 na Metrópole.

### Prefeitura

| Moradores | Etapa | Tamanho | Custo de ampliação |
| --- | --- | --- | --- |
| 0 | Vila | 2×2 | R$ 1.500 (construção) |
| 1.000 | Cidade pequena | 3×3 | R$ 3.000 |
| 5.000 | Cidade | 4×4 com torre | R$ 8.000 |
| 20.000 | Metrópole | 5×5, palácio com praça | R$ 20.000 |

Sem espaço livre, os lotes que atrapalham piscam em vermelho. O painel da prefeitura tem "Melhorar todas as fazendas" (soma dos preços, sem desconto).

## Fazendas

- O jogador pinta a área em formato livre, mínimo 2×2, encostada numa rua. R$ 25 por lote.
- Pintar ao lado de uma fazenda existente a amplia.
- O celeiro aparece no canto mais perto da rua; a cerca acompanha o formato.
- **Produção:** 0,4 trigo por lote por dia × equipamento; 1 trabalhador a cada 3 lotes.
- **Culturas:** só trigo por enquanto; hortaliças, frutas e gado nas etapas seguintes.

| Nível | Equipamento | Custo | Efeito |
| --- | --- | --- | --- |
| 1 | Ferramentas manuais | inicial | base |
| 2 | Trator | R$ 400 + R$ 30 por lote | +50%, trator andando nos campos |
| 3 | Colheitadeira e irrigação | R$ 1.000 + R$ 80 por lote | +100%, 25% menos trabalhadores, aspersores |

## Economia e produção

Cadeias: fazenda → fábrica de alimentos → comércio → moradores; indústria → comércio → moradores; excedentes viram exportação.

| Item | Valor (por dia de jogo, 1,5 s) |
| --- | --- |
| Dinheiro inicial | R$ 10.000 |
| Trabalhadores | 50% dos moradores |
| Fábrica de alimentos (6 empregos, R$ 500) | até 6 trigo viram 6 alimento |
| Indústria | 0,2 mercadoria por emprego |
| Venda do comércio | 1,4 unidade por emprego |
| Consumo por morador | 0,05 alimento e 0,04 mercadoria |
| Exportação | mercadorias acima de 60 e trigo acima de 200 |
| Impostos | R$ 0,15 por morador, R$ 0,20 por funcionário do comércio e da indústria |
| Manutenção | R$ 0,10 por trecho de rua, R$ 0,06 por morador, prédios especiais e fazendas |

## Felicidade, demanda e poluição

- **Felicidade alvo:** 30 + 38 × comida atendida + 10 × mercadorias + 15 × casas perto de praça + 6 com prefeitura − 45 × desemprego − 25 × casas poluídas.
- Abaixo de 40% as casas param de encher; abaixo de 35% moradores vão embora.
- **Poluição:** indústria comum polui 2 lotes ao redor, alta 3; fábrica de alimentos 2.
- **Demanda R/C/I:** R sobe com vagas sobrando; C alvo de 0,2 emprego por morador; I alvo de 0,28.

## Classes sociais e etapas da cidade (Entrega B, feita)

| Moradores | Etapa | Libera |
| --- | --- | --- |
| 0 | Vila | classe baixa, trigo |
| 1.000 | Cidade pequena | classe média, alta densidade, hortaliças, 1º marco, escritórios |
| 5.000 | Cidade | classe alta, frutas, 2º marco |
| 20.000 | Metrópole | torres, gado, 3º marco |

| Classe | Mora em | Trabalha em | Imposto |
| --- | --- | --- | --- |
| Baixa | geminadas, casas pequenas, prédios simples | indústria e comércio comum | baixo |
| Média | sobrados, casas com garagem, edifícios | comércio, escritórios, serviços | médio |
| Alta | mansões, casas modernas grandes, torres de luxo | escritórios e comércio alto | alto; exige serviços e lazer |

- **Escritórios:** 4ª zona, não polui.
- **Demanda por classe:** a barra R vira três barrinhas.
- **Subir de classe:** com bom valor do terreno e, depois, escola e serviços; a casa é reformada.
- **Bairro misto:** a zona residencial é uma só; controle fino virá com distritos.
- **Marcos:** estádio, catedral, torre de TV, parque central; caros, com manutenção, trazem turistas.

### Como ficou no jogo (Entrega B)

- **Empregos por classe:** indústria, fazendas e fábrica de alimentos só classe baixa; comércio comum baixa e média; comércio alto e escritórios média e alta; prefeitura média.
- **Classe que se muda:** sorteada pela demanda de cada classe; média exige terreno com valor de 30% e alta de 50%.
- **Impostos por morador:** baixa R$ 0,10, média R$ 0,20, alta R$ 0,40; funcionário de escritório R$ 0,35.
- **Subir de classe:** casa cheia, felicidade de 55% e terreno valorizado (50% para média, 66% para alta); a casa é reformada para um modelo do mesmo tamanho.
- **Escritórios:** escritório de bairro, clínica, coworking, torre de escritórios, torre espelhada, sede corporativa e centro empresarial (até 4×4).
- **Marcos:** torre de TV (R$ 6.000, 2×2), catedral (R$ 8.000, 3×3), parque central (R$ 5.000, 4×4) e estádio (R$ 15.000, 4×4). Cada etapa a partir da Cidade pequena libera uma vaga. Visitantes rendem R$ 0,60 cada e gastam no comércio; o marco valoriza o terreno num raio de 6 lotes.
- **Interface:** barra por categorias (Ver, Obras, Bairros, Produção, Cidade, Marcos) com bandeja de ferramentas, botões grandes com contorno grosso e sombra sólida, mais espaço entre itens. Barras de demanda B M A, C, I, E.

## Progressão e metas

1. Desenhe uma rua.
2. Pinte um bairro residencial (6 lotes).
3. Chegue a 20 moradores.
4. Crie bairros comerciais e industriais.
5. Pinte uma fazenda (mínimo 2×2).
6. Construa a fábrica de alimentos.
7. Construa a prefeitura.
8. Compre um trator para uma fazenda.
9. Chegue a 1.000 moradores.
10. Faça crescer um prédio de alta densidade.
11. Crie um bairro de escritórios.
12. Construa seu primeiro marco.
13. Amplie a prefeitura.
14. Tenha 100 moradores de classe alta.

## Roadmap

1. **Feito — Fase 1:** câmera, ruas, pontes, cadeia de comida, metas, save.
2. **Feito — Bairros:** zonas R/C/I, duas densidades, ícones e fontes.
3. **Feito — Entrega A:** prédios de 1×1 a 4×4, fazendas pintadas com equipamentos, prefeitura que amplia, 4 etapas.
4. **Feito — Entrega B:** classes sociais, escritórios, famílias subindo de classe, marcos e turismo, interface por categorias.
5. **Depois — Serviços:** energia e água, níveis automáticos de prédio.
6. **Depois — Cidade viva:** carros e caminhões, armazéns, trânsito.
7. **Depois — Distritos e decoração.**
8. **Final:** sons, música, otimização, testes e empacotamento.

### Decisões em aberto

- [ ] Rebalancear a economia (hoje generosa).
- [ ] Modelo de venda (adiado de propósito).
- [ ] Nome do jogo.

## Pesquisa de referência

| Jogo | Sistema central | O que trazer |
| --- | --- | --- |
| [Cities: Skylines](https://en.wikipedia.org/wiki/Cities:_Skylines) | Prédios evoluem com valor do terreno e serviços; distritos com políticas | Níveis automáticos; distritos |
| [Cities: Skylines II](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/economy-production) | Escritórios e indústria especializada | Indústria especializada |
| [TheoTown](https://en.wikipedia.org/wiki/TheoTown) | R/C/I com fazendas; energia, água e rua por lote | Energia e água |
| [Town to City](https://store.steampowered.com/app/3115220/) | Necessidades por etapa, armazéns, decoração | Etapas, armazéns, beleza |
| [SimCity BuildIt](https://www.pocketgamer.com/simcity-buildit/review/) | Fábricas produzem materiais para casas | Evitar travas de free-to-play |
