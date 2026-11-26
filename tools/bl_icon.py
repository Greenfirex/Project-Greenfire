# Vyrenderuje ikonu předmětu z GLB modelu: šikmo shora, průhledné pozadí, měkké světlo.
# blender --background --factory-startup --python tools/bl_icon.py -- '{"src": "...glb", "out": "...png", "size": 512}'
import bpy, json, sys, math
from mathutils import Vector

args = json.loads(sys.argv[sys.argv.index('--') + 1])
size = args.get('size', 512)
yaw = math.radians(args.get('yaw', 35))
pitch = math.radians(args.get('pitch', 38))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args['src'])
scene = bpy.context.scene

meshes = [o for o in scene.objects if o.type == 'MESH']
corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
center = (lo + hi) * 0.5
radius = (hi - lo).length * 0.5

view = Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = radius * 2.0
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
cam.location = center + view * radius * 4
cam.rotation_euler = (-view).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

key = bpy.data.lights.new('key', 'SUN')
key.energy = 3.2
key_obj = bpy.data.objects.new('key', key)
key_obj.rotation_euler = (math.radians(40), 0, math.radians(-30))
scene.collection.objects.link(key_obj)

world = bpy.data.worlds.new('world')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.9
scene.world = world

for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        pass
scene.render.film_transparent = True
scene.render.resolution_x = size
scene.render.resolution_y = size
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = args['out']
bpy.ops.render.render(write_still=True)
