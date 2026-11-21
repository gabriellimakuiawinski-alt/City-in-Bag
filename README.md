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
