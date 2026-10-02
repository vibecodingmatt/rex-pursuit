"""Package a budgeted CC0 Poly Haven scan; raw download remains outside Git."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'coastal-cliff.blend'),use_scripts=False)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
print('SOURCE MESHES',[(o.name,len(o.data.polygons),list(o.dimensions)) for o in meshes])
hero=max(meshes,key=lambda o:len(o.data.polygons))
for o in list(bpy.data.objects):
 if o!=hero:bpy.data.objects.remove(o,do_unlink=True)
hero.hide_set(False);hero.hide_render=False;hero.select_set(True);bpy.context.view_layer.objects.active=hero
for m in list(hero.modifiers):hero.modifiers.remove(m)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
dec=hero.modifiers.new('Web silhouette budget','DECIMATE');dec.ratio=min(1,30000/max(1,len(hero.data.polygons)));bpy.ops.object.modifier_apply(modifier=dec.name)
hero.name='CC0_Coastal_Cliff';hero['creator']='Rob Tuytel / Rico Cilliers';hero['license']='CC0-1.0';hero['source']='https://polyhaven.com/a/coastal_cliff_01'
mat=bpy.data.materials.new('Ravine scanned stone');mat.use_nodes=True;n=mat.node_tree.nodes;l=mat.node_tree.links;p=n.get('Principled BSDF');p.inputs['Roughness'].default_value=.9
for name,socket in [('Diffuse','Base Color'),('Rough','Roughness'),('nor_gl','Normal')]:
 t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(ROOT/f'review/ravine/cliff-{name}.jpg'))
 if name!='Diffuse':t.image.colorspace_settings.name='Non-Color'
 if name=='nor_gl':
  nm=n.new('ShaderNodeNormalMap');l.new(t.outputs['Color'],nm.inputs['Color']);l.new(nm.outputs['Normal'],p.inputs['Normal'])
 else:l.new(t.outputs['Color'],p.inputs[socket])
hero.data.materials.clear();hero.data.materials.append(mat)
for f in hero.data.polygons:f.use_smooth=True
bpy.ops.export_scene.gltf(filepath=str(ROOT.parent/'public/models/ravine-cliff.glb'),export_format='GLB',use_selection=True,export_animations=False,export_extras=True)
print('CLIFF EXPORT COMPLETE',len(hero.data.polygons))
