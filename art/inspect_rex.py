import bpy, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'source-draco.glb'))
data={
 'objects':[{'name':o.name,'type':o.type,'location':list(o.location),'dimensions':list(o.dimensions)} for o in bpy.context.scene.objects],
 'actions':[{'name':a.name,'frames':list(a.frame_range)} for a in bpy.data.actions],
 'bones':[{ 'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local),'parent':b.parent.name if b.parent else None} for o in bpy.context.scene.objects if o.type=='ARMATURE' for b in o.data.bones]
}
(ROOT/'inspection.json').write_text(json.dumps(data,indent=2))
scene=bpy.context.scene
scene.frame_set(1)
points=[o.matrix_world@Vector(c) for o in scene.objects if o.type=='MESH' for c in o.bound_box]
low=Vector([min(p[i] for p in points) for i in range(3)])
high=Vector([max(p[i] for p in points) for i in range(3)])
print('BOUNDS',list(low),list(high),flush=True)
center=(low+high)/2
span=max(high-low)
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.render.resolution_x=1400
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.world.color=(0.15,0.15,0.15)
def area(name,pos,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=pos)
 o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color
 o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
area('Key',center+Vector((span,-span,span)),1400*span**2,span,(1,.87,.73))
area('Rim',center+Vector((-span,span,span*.6)),1800*span**2,span,(.65,.8,1))
bpy.ops.object.camera_add(location=center+Vector((span, -span*.95, span*.45)))
camera=bpy.context.object
camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=span*1.05
scene.camera=camera
scene.render.filepath=str(ROOT/'source-review.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rex-source.blend'))
bpy.ops.render.render(write_still=True)
