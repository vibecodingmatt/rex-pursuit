"""Budget CC0 Poly Haven rock scans for Lost Circuit's ground (A4); run Blender with --disable-autoexec.

Sources (1K glTF downloads, kept in ignored art/review/arcade-a4/src/<asset>/):
  rock_moss_set_01, rock_moss_set_02 (Kless Gyzen) and boulder_01 (Poly Haven), all CC0.
Each rock is re-centred with its base at y=0 and exported at two budgets: <name> near, <name>_LOD far.
"""
import bpy,bmesh
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SRC=ROOT/'review/arcade-a4/src'
# asset, output prefix, near/far triangle budgets
SETS=[('rock_moss_set_01','Boulder',1700,420),('rock_moss_set_02','Stone',760,200),('boulder_01','Crag',2600,640)]
bpy.ops.wm.read_factory_settings(use_empty=True)
keep=[]
for asset,prefix,near,far in SETS:
 before=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=str(SRC/asset/f'{asset}_1k.gltf'))
 meshes=sorted([o for o in bpy.data.objects if o not in before and o.type=='MESH'],key=lambda o:o.name)
 for i,o in enumerate(meshes):
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  o.parent=None
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  # Base at z=0 (glTF y=0), footprint centred.
  xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices];zs=[v.co.z for v in o.data.vertices]
  cx,cy,z0=(min(xs)+max(xs))/2,(min(ys)+max(ys))/2,min(zs)
  for v in o.data.vertices:v.co.x-=cx;v.co.y-=cy;v.co.z-=z0
  for face in o.data.polygons:face.use_smooth=True
  o['source']=f'https://polyhaven.com/a/{asset}';o['license']='CC0-1.0'
  # Weld split vertices (UVs live on face corners, so seams survive); boulder_01 arrives as loose triangles the decimator can't collapse.
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5);bm.to_mesh(o.data);open_edges=sum(1 for e in bm.edges if e.is_boundary);bm.free()
  for budget,suffix in [(near,''),(far,'_LOD')]:
   c=o.copy();c.data=o.data.copy();bpy.context.collection.objects.link(c)
   bpy.ops.object.select_all(action='DESELECT');c.select_set(True);bpy.context.view_layer.objects.active=c
   tris=sum(len(p.vertices)-2 for p in c.data.polygons)
   dec=c.modifiers.new('Web budget','DECIMATE');dec.ratio=min(1,budget/tris);dec.use_collapse_triangulate=True
   bpy.ops.object.modifier_apply(modifier=dec.name)
   c.name=f'{prefix}_{i}{suffix}';c.data.name=c.name;keep.append(c)
   print('PREPARED',c.name,sum(len(p.vertices)-2 for p in c.data.polygons),[round(d,2) for d in c.dimensions],'open edges',open_edges)
for o in list(bpy.data.objects):
 if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT.parent/'public/models/arcade-rocks.glb'),export_format='GLB',use_selection=False,export_animations=False,export_extras=True,export_image_format='JPEG',export_jpeg_quality=88)
