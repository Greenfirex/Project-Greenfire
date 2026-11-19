# Ze sady kamenů z Meshy poskládá jednotlivé kameny do hry: rozdělí sadu na kusy, zjednoduší je,
# zmenší na cílovou velikost a složené kameny (dvojice, kamínky) poskládá z několika kusů.
# Spuštění: blender --background --factory-startup --python bl_rocks.py -- '{"src": ..., "outDir": ..., "rocks": [...]}'
import bpy, sys, json, math
from mathutils import Vector, Matrix

args = json.loads(sys.argv[sys.argv.index('--') + 1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args['src'])
source = [o for o in bpy.data.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = source
source.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')


def bounds(obj):
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


pieces = []
for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
    mn, mx = bounds(obj)
    if max(mx - mn) < 0.02:
        bpy.data.objects.remove(obj)
        continue
    pieces.append((obj, mn, mx))
pieces.sort(key=lambda p: (round(-(p[1].y + p[2].y) / 2 * 4), (p[1].x + p[2].x) / 2))
pieces = [p[0] for p in pieces]
for obj in pieces:
    obj.hide_set(True)
    obj.hide_render = True


def place_part(index, part, name):
    base = pieces[index]
    obj = base.copy()
    obj.data = base.data.copy()
    obj.name = name
    bpy.context.collection.objects.link(obj)
    obj.hide_set(False)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if part['tris'] < tris:
        mod = obj.modifiers.new('dec', 'DECIMATE')
        mod.ratio = part['tris'] / tris
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    yaw = math.radians(part.get('yaw', 0))
    obj.data.transform(Matrix.Rotation(yaw, 4, 'Z'))
    mn, mx = bounds(obj)
    center = (mn + mx) / 2
    obj.data.transform(Matrix.Translation(Vector((-center.x, -center.y, -mn.z))))
    mn, mx = bounds(obj)
    size = mx - mn
    if part.get('box'):
        width, height, depth = part['box']
        obj.data.transform(Matrix.Diagonal(Vector((width / size.x, depth / size.y, height / size.z, 1))))
    else:
        scale = part['height'] / size.z if part.get('height') else part['width'] / max(size.x, size.y)
        obj.data.transform(Matrix.Scale(scale, 4))
    offset = part.get('offset', [0, 0, 0])
    obj.data.transform(Matrix.Translation(Vector((offset[0], -offset[2], offset[1]))))
    return obj


for rock in args['rocks']:
    parts = [place_part(part['piece'], part, f"{rock['key']}_{n}") for n, part in enumerate(rock['parts'])]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = rock['key']
    mn, mx = bounds(joined)
    center = (mn + mx) / 2
    joined.data.transform(Matrix.Translation(Vector((-center.x, -center.y, -mn.z))))
    mn, mx = bounds(joined)
    tris = sum(len(p.vertices) - 2 for p in joined.data.polygons)
    bpy.ops.object.select_all(action='DESELECT')
    joined.select_set(True)
    bpy.ops.export_scene.gltf(filepath=f"{args['outDir']}/{rock['key']}.glb", export_format='GLB', use_selection=True)
    size = mx - mn
    print('ROCK', rock['key'], 'tris', tris, 'size', f'{size.x:.2f} x {size.y:.2f} x {size.z:.2f}')
    bpy.data.objects.remove(joined)
