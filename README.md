# City in Bag

Jogo de construção de cidades para celular e PC, com visual cartunesco 3D e gerenciamento de recursos. Inspirado em CityRT, Cities: Skylines, Town to City e TheoTown.

- **Jogar:** abra `index.html` num servidor local (ou pelo GitHub Pages, se estiver ativado).
- **Documento de design:** [docs/GDD.md](docs/GDD.md)
- **Histórico de mudanças:** [CHANGELOG.md](CHANGELOG.md)

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Estrutura

| Arquivo | O que tem |
| --- | --- |
| `index.html` | interface, fontes, ícones SVG próprios |
| `game.js` | simulação, ferramentas, câmera, save |
| `models.js` | todos os modelos 3D procedurais |
| `docs/GDD.md` | documento de design |

## Controles

- **Celular:** um dedo move a câmera no modo Ver; construindo, um dedo constrói e dois dedos movem e dão zoom.
- **PC:** WASD ou setas, roda do mouse para zoom, Q/E para girar, teclas 1 a 9 para ferramentas.

## Construção de vias

Em **Obras**, selecione Rua, Avenida ou Viaduto. Arraste para definir as pontas da reta ou a corda da curva. O controle de curvatura muda o lado e a intensidade. Na curva de três pontos, toque no início, no ponto que orienta a curva e no fim. Para a rotatória, arraste do centro até a borda. Conecte as entradas à pista circular.

Escolha solo, elevada +1, elevada +2 ou túnel. As rampas podem ficar nas duas pontas, em uma ponta ou em nenhuma. Use trechos com altura constante para prolongar uma estrutura. As conexões usam lotes e níveis. A mão única segue do início para o fim do gesto. A via sobre a água recebe um tabuleiro. Demolir uma via desenhada remove o segmento inteiro selecionado.

## Gestão da cidade

Abra **Menu → Gestão da cidade**. Finanças mostra o último fechamento diário, os impostos, o orçamento de serviços e a importação de alimento. Em Mobilidade, escolha a ordem dos pontos ou estações de cada linha. Um ônibus precisa de garagem e de um caminho de ida e volta. A camada de fluxo destaca os trechos mais usados. No modo Ver, toque na via para consultar a principal viagem estimada. O transporte usa uma amostra de viagens de moradores e de carga.

Em Objetivos, acompanhe os desafios e selecione a vocação econômica. A madeireira fornece madeira à serraria. Armazéns permitem exportar a madeira e ampliar a capacidade de importação. Novo jogo oferece três mapas.

A primeira visita em HTTPS ou localhost prepara a cópia offline. O motor 3D está incluído no repositório. Saves das entregas B e C podem ser recuperados pelo menu. Para rodar os testes de geometria e migração, use Node.js 22 ou superior e execute `node --test tests/city.test.mjs`.
