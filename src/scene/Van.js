import * as THREE from 'three'
import CANNON from 'cannon'
import _ from 'lodash-es'
import assets from '../lib/AssetManager'
import CannonSuperBody from '../lib/CannonSuperBody'
import { HORIZONTAL_GAP } from './Delimiters'
import { getRandomTransparentColor } from '../lib/three-utils'

// collision box dimensions
// in order: x, y, and z width
export const VAN_DIMENSIONS = [7, 2.8, HORIZONTAL_GAP]

const debugColor = getRandomTransparentColor()

export default class Van extends CannonSuperBody {
  mesh = new THREE.Object3D()

  constructor({ webgl, ...options }) {
    super(options)
    this.webgl = webgl

    const vanGltf = assets.get('assets/van.glb')
    const van = vanGltf.scene.clone()

    // position the van correctly
    van.traverse((child) => {
      if (!child.isMesh) {
        return
      }

      child.material.side = THREE.DoubleSide

      child.position.set(0, -1.98, 0)
      child.rotation.y = Math.PI / 2
      child.scale.multiplyScalar(16 / VAN_DIMENSIONS[0])

      // we don't cast chadows because otherwise the
      // shrimps inside would appear dark
      // child.castShadow = true
      child.receiveShadow = true
    })

    this.mesh.add(van)

    const vanShape = new CANNON.Box(new CANNON.Vec3(...VAN_DIMENSIONS.map((d) => d * 0.5)))
    this.addShape(vanShape)

    if (window.DEBUG) {
      const geometry = new THREE.BoxGeometry(...VAN_DIMENSIONS)
      const material = new THREE.MeshLambertMaterial(debugColor)
      const mesh = new THREE.Mesh(geometry, material)
      this.mesh.add(mesh)
    }

    // add the shrimps inside
    const shrimpGltf = assets.get('assets/shrimp.glb')
    this.vanShrimps = _.range(0, 8).map(() => shrimpGltf.scene.clone())

    // position the shrimps in the van
    this.vanShrimps.forEach((shrimp, i) => {
      shrimp.traverse((child) => {
        if (!child.isMesh) {
          return
        }

        // make the driver big, the second small, and the others random
        switch (i) {
          case 0:
            child.rotateZ(Math.PI / 3.3)
            child.scale.multiplyScalar(0.45)
            break
          case 1:
            child.rotateZ(Math.PI / 2.8)
            child.scale.multiplyScalar(0.3)
            break
          default:
            child.rotateZ(Math.PI / _.random(2.8, 3.3))
            child.scale.multiplyScalar(_.random(0.25, 0.45))
        }

        const x = 2 - Math.floor(i / 2) * 1.4
        const y = 0.2
        const z = -0.7 * Math.cos((i % 2) * Math.PI)
        child.position.set(x, y, z)

        // save it for later
        this.initialY = y
      })

      this.mesh.add(shrimp)
    })
  }

  update(dt = 0, time = 0) {
    // sync the mesh to the physical body
    this.mesh.position.copy(this.position)
    this.mesh.quaternion.copy(this.quaternion)

    // make the shrimps jump up and down
    this.vanShrimps.forEach((shrimp, i) => {
      shrimp.traverse((child) => {
        if (!child.isMesh) {
          return
        }

        child.position.y = this.initialY + Math.sin(time * 20 + i) * 0.09
      })
    })
  }
}
