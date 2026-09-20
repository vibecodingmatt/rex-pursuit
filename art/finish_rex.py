"""Finish the rebound creature; save the editable master and web GLB.
Run: blender --background --python art/finish_rex.py
"""
import bpy, math, json
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT.parent/'public/models/rex-encounter.glb'))
scene=bpy.context.scene
for o in scene.objects:
 if o.animation_data:o.animation_data.action=None
scene.frame_set(0)
# Warm, desaturated brown albedo is embedded in the reusable model itself.
for mat in bpy.data.materials:
 if mat.name=='BodyMat':
  p=mat.node_tree.nodes.get('Principled BSDF')
  for node in mat.node_tree.nodes:
   if node.type=='TEX_IMAGE' and node.image and any(link.to_socket==p.inputs['Base Color'] for link in node.outputs['Color'].links):
    old=node.image;size=old.size[:];pixels=np.empty(size[0]*size[1]*4,dtype=np.float32);old.pixels.foreach_get(pixels);pixels=pixels.reshape(-1,4)
    lum=pixels[:,:3]@np.array([.299,.587,.114],dtype=np.float32)
    pixels[:,:3]=pixels[:,:3]*.05+lum[:,None]*np.array([1.04,.66,.40],dtype=np.float32)*.95
    image=bpy.data.images.new('Rex_Brown_Albedo',width=size[0],height=size[1],alpha=True)
    image.pixels.foreach_set(pixels.ravel());image.filepath_raw=str(ROOT/'rex-brown-albedo.png');image.file_format='PNG';image.save();image.pack();node.image=image
  mat['palette']='authored-brown';p.inputs['Roughness'].default_value=.72
for obj in list(scene.objects):
 if obj.type=='MESH' and not obj.hide_render:
  for poly in obj.data.polygons:poly.use_smooth=True
  if obj.name=='Rex_Skin':
   bpy.context.view_layer.objects.active=obj
   # One editable subdivision level keeps the browser silhouette smooth.
   mod=obj.modifiers.new('Silhouette refinement','SUBSURF');mod.levels=1;mod.render_levels=1
   # Apply before the armature to preserve deform weights and rest topology.
   bpy.ops.object.modifier_move_to_index(modifier=mod.name,index=0)
   bpy.ops.object.modifier_apply(modifier=mod.name)
scene.frame_set(0);bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get()
points=[]
for obj in scene.objects:
 if obj.type=='MESH':
  ev=obj.evaluated_get(dg);points.extend(ev.matrix_world@v.co for v in ev.data.vertices)
low=Vector([min(p[i] for p in points) for i in range(3)]);high=Vector([max(p[i] for p in points) for i in range(3)])
print('FINISHED BOUNDS',list(low),list(high),flush=True)
# Export while the scene contains only the actual asset.
bpy.ops.export_scene.gltf(filepath=str(ROOT.parent/'public/models/rex-hero.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_extras=True,export_yup=True)
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.12,.12,.12)
center=(low+high)/2;span=max(high-low)
def light(pos,energy,color,size):
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=energy;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
light(center+Vector((5,-8,9)),1700,(1,.82,.63),7)
light(center+Vector((-7,3,7)),2300,(.66,.82,1),6)
bpy.ops.object.camera_add(location=center+Vector((12,-15,5)))
camera=bpy.context.object;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=span*.95;scene.camera=camera
scene.render.filepath=str(ROOT/'rex-master-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rex-encounter.blend'))
bpy.ops.render.render(write_still=True)
(ROOT/'asset-report.json').write_text(json.dumps({'bounds_min':list(low),'bounds_max':list(high),'actions':[a.name for a in bpy.data.actions],'meshes':[{'name':o.name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons)} for o in scene.objects if o.type=='MESH' and not o.hide_render]},indent=2))
