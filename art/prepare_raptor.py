"""Prepare Animaniac888's CC0 Dromaeosaur for the ravine. No source scripts run.
blender --background --disable-autoexec --python art/prepare_raptor.py
Source and SHA256 are recorded in public/models/raptor-ravine.source.json.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Matrix
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Dromaeosaur.blend'),use_scripts=False)
rig=bpy.data.objects['Armature']
keep={'Armature','Dromaeosaur','Claws','Teeth','Eye'}
for o in list(bpy.data.objects):
 if o.name not in keep:bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.data.objects:
 o.animation_data_clear()
 for c in list(o.constraints):o.constraints.remove(c)
for b in rig.pose.bones:
 b.matrix_basis=Matrix.Identity(4)
 for c in list(b.constraints):b.constraints.remove(c)
# Eyes were not attached in the original distribution. Use rigid skin weights
# instead of a fragile object/bone-parent offset so every GLTF clone follows.
eye=bpy.data.objects['Eye'];eye.vertex_groups.clear()
eye.vertex_groups.new(name='Bone.016').add(list(range(len(eye.data.vertices))),1,'REPLACE')
eye.modifiers.new('Follow skull','ARMATURE').object=rig
eye.parent=rig
# The source also leaves mouth-interior vertices completely unweighted. glTF
# assigns those to a neutral bone, leaving pink tissue hanging outside a posed
# jaw. Transfer only these missing bindings from the nearest weighted surface.
for name in ['Dromaeosaur','Teeth','Claws']:
 ob=bpy.data.objects[name];verts=ob.data.vertices
 valid=[v for v in verts if sum(g.weight for g in v.groups)>.0001]
 tree=KDTree(len(valid))
 for v in valid:tree.insert(v.co,v.index)
 tree.balance();repaired=0
 for v in verts:
  if sum(g.weight for g in v.groups)>.0001:continue
  _,nearest,_=tree.find(v.co);weights=[g for g in verts[nearest].groups if g.weight>.0001];total=sum(g.weight for g in weights)
  for g in weights:ob.vertex_groups[g.group].add([v.index],g.weight/total,'REPLACE')
  repaired+=1
 print('REPAIRED UNBOUND VERTICES',name,repaired)
for name,image,rough,color in [('Dromaeosaur','Diffuse',.8,(.82,.87,.76,1)),('Eye','Raptor Eye.png',.22,(1,1,1,1)),('Teeth',None,.57,(.64,.58,.39,1)),('Claws',None,.68,(.055,.047,.031,1))]:
 mat=bpy.data.materials[name];mat.use_nodes=True;mat.node_tree.nodes.clear();nodes=mat.node_tree.nodes;links=mat.node_tree.links
 out=nodes.new('ShaderNodeOutputMaterial');p=nodes.new('ShaderNodeBsdfPrincipled');links.new(p.outputs['BSDF'],out.inputs['Surface']);p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=rough
 p.inputs['Specular IOR Level'].default_value=.28
 if image:
  tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images[image];tex.image.colorspace_settings.name='sRGB';links.new(tex.outputs['Color'],p.inputs['Base Color'])
 if name=='Dromaeosaur':
  tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images['Normal2.png'];tex.image.colorspace_settings.name='Non-Color'
  normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.7;links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
# Remove zero-level legacy subdivision and preserve the existing detailed skin.
for o in bpy.data.objects:
 if o.type!='MESH':continue
 for m in list(o.modifiers):
  if m.type!='ARMATURE':o.modifiers.remove(m)
 for f in o.data.polygons:f.use_smooth=True
 o.select_set(True)
rig.select_set(True)
rig['creator']='Animaniac888';rig['license']='CC0-1.0';rig['source']='https://blendswap.com/blend/4889'
# Neutral asset is deliberately exported at authored size. Runtime fits the
# same 5.8 m individual and floor for both mesh tiers.
bpy.ops.export_scene.gltf(filepath=str(ROOT.parent/'public/models/raptor-ravine.glb'),export_format='GLB',use_selection=True,export_animations=False,export_extras=True,export_image_format='JPEG',export_jpeg_quality=93,export_yup=True,export_apply=False)
print('RAPTOR EXPORT COMPLETE')
