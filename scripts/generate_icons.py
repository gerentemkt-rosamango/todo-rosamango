#!/usr/bin/env python3
"""Gera os ícones do PWA (preto/branco/vermelho, identidade Rosamango).

Uso:
    uv run scripts/generate_icons.py
    uv run scripts/generate_icons.py --out-dir src/icons --sizes 192,512
    uv run scripts/generate_icons.py --help
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

PRETO = (0, 0, 0, 255)
BRANCO = (255, 255, 255, 255)
VERMELHO = (179, 38, 30, 255)


def desenhar_checkmark(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], cor, espessura: int) -> None:
    """Desenha um check estilizado dentro do retângulo `box`."""
    x0, y0, x1, y1 = box
    largura, altura = x1 - x0, y1 - y0
    pontos = [
        (x0 + largura * 0.08, y0 + altura * 0.55),
        (x0 + largura * 0.40, y0 + altura * 0.85),
        (x0 + largura * 0.95, y0 + altura * 0.15),
    ]
    draw.line(pontos, fill=cor, width=espessura, joint="curve")
    raio = espessura / 2
    for ponto in pontos:
        draw.ellipse((ponto[0] - raio, ponto[1] - raio, ponto[0] + raio, ponto[1] + raio), fill=cor)


def gerar_icone(tamanho: int, maskable: bool) -> Image.Image:
    img = Image.new("RGBA", (tamanho, tamanho), PRETO)
    draw = ImageDraw.Draw(img)

    # Ponto de acento vermelho no canto superior direito.
    raio_acento = tamanho * 0.16
    cx, cy = tamanho * 0.78, tamanho * 0.24
    draw.ellipse((cx - raio_acento, cy - raio_acento, cx + raio_acento, cy + raio_acento), fill=VERMELHO)

    # Zona segura maior para ícones maskable (Android recorta ~20% das bordas).
    margem = tamanho * (0.28 if maskable else 0.18)
    box = (margem, margem, tamanho - margem, tamanho - margem)
    desenhar_checkmark(draw, box, BRANCO, espessura=max(2, int(tamanho * 0.09)))

    return img


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out-dir", default="src/icons", help="Pasta de saída (padrão: src/icons)")
    parser.add_argument("--sizes", default="192,512", help="Tamanhos 'any', separados por vírgula (padrão: 192,512)")
    parser.add_argument("--maskable-size", type=int, default=512, help="Tamanho do ícone maskable (padrão: 512)")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for tamanho_str in args.sizes.split(","):
        tamanho = int(tamanho_str.strip())
        caminho = out_dir / f"icon-{tamanho}.png"
        gerar_icone(tamanho, maskable=False).save(caminho)
        print(f"gerado: {caminho}")

    caminho_maskable = out_dir / f"icon-maskable-{args.maskable_size}.png"
    gerar_icone(args.maskable_size, maskable=True).save(caminho_maskable)
    print(f"gerado: {caminho_maskable}")


if __name__ == "__main__":
    main()
