import * as THREE from 'three'
import CANNON from 'cannon'
import _ from 'lodash-es'
import assets from '../lib/AssetManager'
import { vehicleCollision } from './collisions'
import Fiat126, { FIAT_DIMENSIONS } from './Fiat126'
import Van, { VAN_DIMENSIONS } from './Van'
import { VERTICAL_GAP } from './Delimiters'
import { playAudio } from '../lib/audio-utils'

export default class Vehicles extends THREE.Group {
  vehicles = []
  shouldGoFiat = false

  constructor({ webgl, ...options }) {
    super(options)
    this.webgl = webgl

    // not loaded with the other assets because
    // they're not needed immediately
    Promise.all([
      assets.loadSingle({
        url: 'assets/van.glb',
        type: 'gltf',
        renderer: webgl.renderer,
      }),
      assets.loadSingle({
        url: 'assets/sounds/striscia-clacson_lowpass.mp3',
        type: 'audio',
        renderer: webgl.renderer,
      }),
      assets.loadSingle({
        url: 'assets/fiat126.glb',
        type: 'gltf',
        renderer: webgl.renderer,
      }),
      assets.loadSingle({
        url: 'assets/sounds/small-car-horn_lowpass.mp3',
        type: 'audio',
        renderer: webgl.renderer,
      }),
    ]).then(() => {
      window.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          this.createVehicle()
        }
      })

      window.addEventListener('shake', () => {
        this.createVehicle()
      })
    })
  }

  createVehicle() {
    const maxX = this.webgl.frustumSize.width / 2

    const Vehicle = this.shouldGoFiat ? Fiat126 : Van
    const DIMENSIONS = this.shouldGoFiat ? FIAT_DIMENSIONS : VAN_DIMENSIONS

    const hornBuffer = assets.get(
      this.shouldGoFiat
        ? 'assets/sounds/small-car-horn_lowpass.mp3'
        : 'assets/sounds/striscia-clacson_lowpass.mp3'
    )
    playAudio(hornBuffer, this.webgl.audioContext)

    this.shouldGoFiat = !this.shouldGoFiat

    const vehicle = new Vehicle({
      webgl: this.webgl,
      // the material is the same as the van
      material: vehicleCollision.material,
      collisionFilterGroup: vehicleCollision.id,
      collisionFilterMask: vehicleCollision.collideWith,
      type: CANNON.Body.DYNAMIC,
      mass: 50,
      // simulate the water
      angularDamping: 0.98,
      // movement damping is handled by the drag force
      // linearDamping: 0.98,
      position: new CANNON.Vec3(
        -maxX - DIMENSIONS[0],
        _.random(0, VERTICAL_GAP / 2 - DIMENSIONS[1] / 2),
        0
      ),
    })

    // add the body to the cannon.js world
    this.webgl.world.addBody(vehicle)
    // and the mesh to the three.js scene
    this.add(vehicle.mesh)

    // save it
    vehicle.DIMENSIONS = DIMENSIONS
    this.vehicles.push(vehicle)

    // give it a push!
    vehicle.applyGenericImpulse(new CANNON.Vec3(800, 0, 0))
  }

  update(dt = 0, time = 0) {
    const maxX = this.webgl.frustumSize.width / 2

    this.vehicles.forEach((vehicle) => {
      // apply a quadratic drag force to simulate water
      vehicle.applyDrag(0.8)

      // the force moving the vehicle left
      vehicle.applyGenericForce(new CANNON.Vec3(100, 0, 0))

      // remove it if they exit the field of view
      if (maxX + vehicle.DIMENSIONS[0] / 2 < vehicle.position.x) {
        this.webgl.world.removeBody(vehicle)
        this.remove(vehicle.mesh)
        this.vehicles.splice(
          this.vehicles.findIndex((v) => v.id === vehicle.id),
          1
        )
      }
    })
  }
}
