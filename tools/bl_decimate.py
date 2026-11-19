# Zjednoduší model v Blenderu (Decimate) a uloží ho jako glb: -- '{"src": ..., "out": ..., "ratio": 0.15}'
import bpy, sys, json
args = json.loads(sys.argv[sys.argv.index('--') + 1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args['src'])
for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
    mod = obj.modifiers.new('dec', 'DECIMATE')
    mod.ratio = args['ratio']
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print('TRIS', obj.name, sum(len(p.vertices) - 2 for p in obj.data.polygons))
bpy.ops.export_scene.gltf(filepath=args['out'], export_format='GLB')
