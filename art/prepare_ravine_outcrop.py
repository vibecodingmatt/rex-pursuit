"""Budget CC0 Namaqualand Cliff 02; run Blender with --disable-autoexec."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'namaqualand-cliff.blend'),use_scripts=False)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
print('SOURCE',[(o.name,len(o.data.polygons),list(o.dimensions)) for o in meshes])
hero=max(meshes,key=lambda o:len(o.data.polygons))
for o in list(bpy.data.objects):
 if o!=hero:bpy.data.objects.remove(o,do_unlink=True)
hero.hide_set(False);hero.hide_render=False;hero.select_set(True);bpy.context.view_layer.objects.active=hero
for mod in list(hero.modifiers):hero.modifiers.remove(mod)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
mat=bpy.data.materials.new('CC0 fractured stone');mat.use_nodes=True
n=mat.node_tree.nodes;l=mat.node_tree.links;p=n.get('Principled BSDF')
for name,socket in [('Diffuse','Base Color'),('Rough','Roughness'),('nor_gl','Normal')]:
 tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/f'review/ravine/nama-{name}.jpg'))
 if name!='Diffuse':tex.image.colorspace_settings.name='Non-Color'
 if name=='nor_gl':
  nm=n.new('ShaderNodeNormalMap');l.new(tex.outputs['Color'],nm.inputs['Color']);l.new(nm.outputs['Normal'],p.inputs['Normal'])
 else:l.new(tex.outputs['Color'],p.inputs[socket])
hero.data.materials.clear();hero.data.materials.append(mat)
hero['source']='https://polyhaven.com/a/namaqualand_cliff_02';hero['license']='CC0-1.0';hero['creators']='Dario Barresi / Rico Cilliers'
for face in hero.data.polygons:face.use_smooth=True
for budget,name in [(16000,'Ravine_Outcrop'),(3500,'Ravine_Outcrop_LOD')]:
 dec=hero.modifiers.new('Web budget','DECIMATE');dec.ratio=min(1,budget/len(hero.data.polygons));bpy.ops.object.modifier_apply(modifier=dec.name)
 hero.name=name
 if budget==16000:
  detailed=hero.copy();detailed.data=hero.data.copy();bpy.context.collection.objects.link(detailed)
  detailed.name='Ravine_Outcrop_High'
 print('PREPARED',name,len(hero.data.polygons))
bpy.ops.export_scene.gltf(filepath=str(ROOT.parent/'public/models/ravine-outcrop.glb'),export_format='GLB',use_selection=False,export_animations=False,export_extras=True,export_image_format='JPEG',export_jpeg_quality=90)
