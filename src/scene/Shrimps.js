import * as THREE from 'three'
import CANNON from 'cannon'
import _ from 'lodash'
import assets from 'lib/AssetManager'
import CannonSuperBody from 'lib/CannonSuperBody'
import { shrimpCollision } from 'scene/collisions'
import { VERTICAL_GAP } from 'scene/Delimiters'
import { getRandomTransparentColor } from 'lib/three-utils'

// where the shrimps will die
export const MAX_X_POSITION = 12

// the interval between the spawn of shrimps (seconds)
export let SHRIMP_INTERVAL = 3

export const SHRIMP_RADIUS = 1
export const SHRIMP_HEIGHT = 0.5

const shrimpGltfKey = assets.queue({
  url: 'assets/shrimp.glb',
  type: 'gltf',
})

// if I don't do this, the shrimp is not visible
// TODO understand why
new THREE.BufferGeometry() // eslint-disable-line

// TODO test shadows
// sphere.castShadow = true; //default is false
// sphere.receiveShadow = false; //default

const debugColor = getRandomTransparentColor()

class Shrimp extends CannonSuperBody {
  // no need to handle position, velocity and acceleration,
  // CANNON.Body already has those

  mesh = new THREE.Object3D()

  constructor({ webgl, ...options }) {
    super(options)
    this.webgl = webgl

    const shrimpGltf = assets.get(shrimpGltfKey)
    this.mesh.copy(shrimpGltf.scene)

    // position the shrimp correctly
    this.mesh.traverse(child => {
      if (!child.isMesh) {
        return
      }

      child.rotateY(Math.PI / 8)
      child.rotateX(Math.PI / 2)
      child.scale.multiplyScalar(0.88)
    })

    const shrimpShape = new CANNON.Cylinder(SHRIMP_RADIUS, SHRIMP_RADIUS, SHRIMP_HEIGHT, 32)
    this.addShape(shrimpShape)

    if (window.DEBUG) {
      const geometry = new THREE.CylinderGeometry(SHRIMP_RADIUS, SHRIMP_RADIUS, SHRIMP_HEIGHT, 32)
      const material = new THREE.MeshLambertMaterial(debugColor)
      const cylinderMesh = new THREE.Mesh(geometry, material)
      this.mesh.add(cylinderMesh)
    }
  }

  update(dt = 0, time = 0) {
    // sync the mesh to the physical body
    this.mesh.position.copy(this.position)
    this.mesh.quaternion.copy(this.quaternion)
  }
}

export default class Shrimps extends THREE.Object3D {
  shrimps = []

  constructor({ webgl, ...options }) {
    super(options)
    this.webgl = webgl

    if (window.DEBUG) {
      this.webgl.panel.on('input', inputs => {
        SHRIMP_INTERVAL = inputs['Shrimp Spawn Interval']
      })
    }
  }

  update(dt = 0, time = 0) {
    // spawn new shrimps
    if (!this.lastSpawnTimestamp || time - this.lastSpawnTimestamp > SHRIMP_INTERVAL) {
      this.lastSpawnTimestamp = time

      const shrimp = new Shrimp({
        webgl: this.webgl,
        material: shrimpCollision.material,
        collisionFilterGroup: shrimpCollision.id,
        collisionFilterMask: shrimpCollision.collideWith,
        type: CANNON.Body.DYNAMIC,
        mass: 1,
        // simulate the water
        angularDamping: 0.98,
        // movement damping is handled by the drag force
        // linearDamping: 0.98,
        // move them around a bit
        // angularVelocity: new CANNON.Vec3(0.3 * _.random(-1, 1), 0.3 * _.random(-1, 1), 0),
        position: new CANNON.Vec3(
          -MAX_X_POSITION,
          _.random(-(VERTICAL_GAP / 2) * 0.9, (VERTICAL_GAP / 2) * 0.9),
          0,
        ),
        // put them vertical
        quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0),
      })

      // add the body to the cannon.js world
      this.webgl.world.addBody(shrimp)
      // and the mesh to the three.js scene
      this.add(shrimp.mesh)
      // save it
      this.shrimps.push(shrimp)
    }

    this.shrimps.forEach(shrimp => {
      // apply a quadratic drag force to simulate water
      shrimp.applyDrag(0.8)

      // the force moving the shrimp left
      shrimp.applyGenericForce(new CANNON.Vec3(0.6, 0, 0))

      // remove it if they exit the field of view
      if (MAX_X_POSITION < shrimp.position.x) {
        this.webgl.world.removeBody(shrimp)
        this.remove(shrimp.mesh)
        this.shrimps.splice(this.shrimps.findIndex(s => s.id === shrimp.id), 1)
      }
    })
  }
}
