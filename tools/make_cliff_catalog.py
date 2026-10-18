# Vykreslí izometrický náhledový katalog cliff modelů do jednoho PNG.
# Každý model sedí na čtverci půdorysu buňky s kompasem, aby bylo vidět,
# kde v buňce geometrie leží a kterou stranou se model lepí na sousední blok.
import json
import math
import os
import re
import struct
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB_DIR = os.path.join(ROOT, "public", "assets", "nature", "cliffs")
OUT = os.path.join(ROOT, "tools", "_temp", "cliff_catalog.png")

CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942
COMPONENTS = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
COMPONENT_COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
CELL = 1.0
TILE = 200
COLS = 5
HEADER = 40
LABEL_LINES = 3
LABEL_HEIGHT = 10

COS30 = math.cos(math.radians(30))
SIN30 = math.sin(math.radians(30))


def read_glb(path):
    with open(path, "rb") as handle:
        data = handle.read()
    if struct.unpack_from("<I", data, 0)[0] != 0x46546C67:
        return None

    gltf = None
    bin_chunk = None
    offset = 12
    while offset + 8 <= len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        start = offset + 8
        if chunk_type == CHUNK_JSON:
            gltf = json.loads(data[start:start + length].decode("utf-8"))
        elif chunk_type == CHUNK_BIN:
            bin_chunk = data[start:start + length]
        offset = start + length

    if gltf is None:
        return None
    gltf["_bin"] = bin_chunk
    return gltf


def accessor_values(gltf, index):
    accessor = gltf["accessors"][index]
    view = gltf["bufferViews"][accessor["bufferView"]]
    count = COMPONENT_COUNT[accessor["type"]]
    fmt, size = COMPONENTS[accessor["componentType"]]
    element = count * size
    stride = view.get("byteStride", element)
    base = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return [struct.unpack_from("<" + fmt * count, gltf["_bin"], base + i * stride) for i in range(accessor["count"])]


def load_mesh(path):
    gltf = read_glb(path)
    if gltf is None:
        return None

    points = []
    triangles = []
    for mesh in gltf.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if "POSITION" not in primitive.get("attributes", {}):
                continue
            base = len(points)
            positions = accessor_values(gltf, primitive["attributes"]["POSITION"])
            points.extend(positions)
            if primitive.get("indices") is not None:
                indices = [value[0] for value in accessor_values(gltf, primitive["indices"])]
                for i in range(0, len(indices) - 2, 3):
                    triangles.append((base + indices[i], base + indices[i + 1], base + indices[i + 2]))
            else:
                for i in range(0, len(positions) - 2, 3):
                    triangles.append((base + i, base + i + 1, base + i + 2))

    if not points:
        return None
    return points, triangles


def project(x, y, z):
    return (x - z) * COS30, (x + z) * SIN30 - y


def render(points, triangles, size):
    scale = (size - 88) / (CELL * 1.9)
    center_x = size / 2
    center_y = size / 2 + 6

    flat = []
    for p in points:
        sx, sy = project(p[0], p[1], p[2])
        flat.append((center_x + sx * scale, center_y + sy * scale))

    image = Image.new("RGB", (size, size), (250, 250, 247))
    draw = ImageDraw.Draw(image)

    polygon = []
    for cx, cz in [(-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)]:
        sx, sy = project(cx, 0, cz)
        polygon.append((center_x + sx * scale, center_y + sy * scale))
    draw.polygon(polygon, outline=(206, 206, 206))
    for i in range(4):
        draw.line([polygon[i], polygon[(i + 1) % 4]], fill=(206, 206, 206))

    faces = []
    for triangle in triangles:
        a, b, c = points[triangle[0]], points[triangle[1]], points[triangle[2]]
        depth = (a[0] + a[2] + b[0] + b[2] + c[0] + c[2]) / 3.0
        height = (a[1] + b[1] + c[1]) / 3.0
        ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        nx = uy * vz - uz * vy
        ny = uz * vx - ux * vz
        length = math.sqrt(nx * nx + ny * ny) or 1.0
        faces.append((depth, height, ny / length, triangle))

    faces.sort(key=lambda item: (item[0], item[1]))
    for depth, height, normal_y, triangle in faces:
        light = 0.55 + 0.45 * max(0.0, normal_y)
        if normal_y > 0.7:
            color = (int(150 * light + 55), int(185 * light + 50), int(125 * light + 55))
        elif normal_y > 0.15:
            color = (int(150 * light + 40), int(150 * light + 40), int(150 * light + 40))
        else:
            color = (int(115 * light + 40), int(110 * light + 40), int(100 * light + 40))
        draw.polygon([flat[triangle[0]], flat[triangle[1]], flat[triangle[2]]], fill=color, outline=(72, 72, 72))

    arrow_x, arrow_y = project(0, 0, 0.66)
    arrow_x = center_x + arrow_x * scale
    arrow_y = center_y + arrow_y * scale
    draw.line([(arrow_x, arrow_y), (arrow_x, arrow_y + 22)], fill=(180, 60, 60), width=2)
    draw.polygon([(arrow_x, arrow_y - 4), (arrow_x - 5, arrow_y + 6), (arrow_x + 5, arrow_y + 6)], fill=(180, 60, 60))
    draw.text((arrow_x + 7, arrow_y + 6), "S", fill=(180, 60, 60))
    draw.text((6, 6), "sipka = +Z (jih)", fill=(150, 60, 60))

    return image


def collect(filter_pattern):
    pattern = re.compile(filter_pattern) if filter_pattern else None
    files = sorted(name for name in os.listdir(GLB_DIR) if name.startswith("cliff_") and name.endswith(".glb"))

    items = []
    for name in files:
        short = name[len("cliff_"):-len(".glb")]
        if short.endswith("_rock"):
            short = short[:-len("_rock")]
        if pattern and not pattern.search(short):
            continue
        mesh = load_mesh(os.path.join(GLB_DIR, name))
        if mesh is None:
            continue
        points, triangles = mesh
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        zs = [p[2] for p in points]
        label = "cliff_%s\nX %.2f..%.2f  Y %.2f..%.2f\nZ %.2f..%.2f" % (
            short, min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))
        items.append((label, points, triangles))
    return items


def main():
    args = sys.argv[1:]
    filter_pattern = args[args.index("--filter") + 1] if "--filter" in args else None

    items = collect(filter_pattern)
    if not items:
        print("Nic k vykresleni.")
        return

    rows = (len(items) + COLS - 1) // COLS
    width = COLS * TILE
    height = HEADER + rows * (TILE + LABEL_LINES * LABEL_HEIGHT + 4)

    sheet = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((10, 12), "Cliff assety \u2014 izometricky nahled (ctverec = pudorys bunky)", fill=(20, 20, 20))

    for index, (label, points, triangles) in enumerate(items):
        col = index % COLS
        row = index // COLS
        x = col * TILE
        y = HEADER + row * (TILE + LABEL_LINES * LABEL_HEIGHT + 4)
        sheet.paste(render(points, triangles, TILE), (x, y))
        draw.rectangle([x, y, x + TILE - 1, y + TILE - 1], outline=(216, 216, 216))
        for line_index, line in enumerate(label.split("\n")):
            draw.text((x + 4, y + TILE + 2 + line_index * LABEL_HEIGHT), line, fill=(40, 40, 40))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT)
    print("Ulozeno:", OUT)
    print("Modelu:", len(items), "| rozlozeni:", COLS, "x", rows)


main()
