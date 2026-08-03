import * as THREE from "three";
import { Palette } from "../voxel/palette";
import { Role } from "../../core/types";
import { VOXEL_SIZE } from "../voxel/mesher";
import { PIECE_DEFINITIONS } from "../voxel/pieces";

interface DebrisShard {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  life: number;
  maxLife: number;
  initialScale: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export class VoxelDebrisManager {
  readonly group = new THREE.Group();
  private shards: DebrisShard[] = [];
  private sparks: SparkParticle[] = [];

  private shardMaterialPool: THREE.MeshLambertMaterial[] = [];
  private sparkMaterialPool: THREE.MeshBasicMaterial[] = [];

  private shardGeometry = new THREE.BoxGeometry(
    VOXEL_SIZE * 1.2,
    VOXEL_SIZE * 1.2,
    VOXEL_SIZE * 1.2,
  );
  private sparkGeometry = new THREE.PlaneGeometry(
    VOXEL_SIZE * 0.9,
    VOXEL_SIZE * 0.9,
  );

  constructor() {
    this.group.name = "voxelDebrisGroup";
    this.sparkGeometry.rotateX(-Math.PI / 2);
  }

  private getShardMaterial(color: THREE.Color): THREE.MeshLambertMaterial {
    const mat = this.shardMaterialPool.pop();
    if (mat) {
      mat.color.copy(color);
      mat.opacity = 1.0;
      return mat;
    }
    return new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 1.0,
    });
  }

  private getSparkMaterial(color: THREE.Color): THREE.MeshBasicMaterial {
    const mat = this.sparkMaterialPool.pop();
    if (mat) {
      mat.color.copy(color);
      mat.opacity = 1.0;
      return mat;
    }
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
  }

  spawnExplosion(
    position: THREE.Vector3,
    palette: Palette,
    role: Role,
    count = 32,
  ) {
    const baseColors = [
      new THREE.Color(palette.base),
      new THREE.Color(palette.accent),
      new THREE.Color(palette.shade),
      new THREE.Color(palette.detail),
    ];

    const def = PIECE_DEFINITIONS[role];
    const pieceHeight = def ? def.grid.length * VOXEL_SIZE : 0.8;

    // Spawn Voxel Shards
    for (let i = 0; i < count; i++) {
      const color = baseColors[i % baseColors.length]!;
      const mat = this.getShardMaterial(color);
      const mesh = new THREE.Mesh(this.shardGeometry, mat);

      // Distribute spawn positions within piece volume
      const offsetX = (Math.random() - 0.5) * 0.5;
      const offsetY = Math.random() * pieceHeight * 0.8 + 0.1;
      const offsetZ = (Math.random() - 0.5) * 0.5;

      mesh.position.set(
        position.x + offsetX,
        position.y + offsetY,
        position.z + offsetZ,
      );

      const scale = 0.8 + Math.random() * 0.8;
      mesh.scale.set(scale, scale, scale);

      // Explosive 3D outward velocities
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 2.8;
      const vx = Math.cos(angle) * speed;
      const vz = Math.sin(angle) * speed;
      const vy = 2.5 + Math.random() * 3.5;

      // Angular velocity
      const rx = (Math.random() - 0.5) * 18;
      const ry = (Math.random() - 0.5) * 18;
      const rz = (Math.random() - 0.5) * 18;

      const life = 0.4 + Math.random() * 0.35;

      this.group.add(mesh);
      this.shards.push({
        mesh,
        vx,
        vy,
        vz,
        rx,
        ry,
        rz,
        life,
        maxLife: life,
        initialScale: scale,
      });
    }

    // Spawn Glowing Spark Particles
    const sparkCount = 18;
    const sparkColor = new THREE.Color(palette.accent);
    for (let i = 0; i < sparkCount; i++) {
      const mat = this.getSparkMaterial(sparkColor);
      const mesh = new THREE.Mesh(this.sparkGeometry, mat);
      mesh.position.set(
        position.x + (Math.random() - 0.5) * 0.2,
        0.05,
        position.z + (Math.random() - 0.5) * 0.2,
      );

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 3.0;
      const vx = Math.cos(angle) * speed;
      const vz = Math.sin(angle) * speed;
      const vy = 0.5 + Math.random() * 1.5;

      const life = 0.25 + Math.random() * 0.2;

      this.group.add(mesh);
      this.sparks.push({
        mesh,
        vx,
        vy,
        vz,
        life,
        maxLife: life,
      });
    }
  }

  update(dt: number) {
    if (this.shards.length === 0 && this.sparks.length === 0) return;

    const gravity = -14.0;
    const activeShards: DebrisShard[] = [];

    for (const shard of this.shards) {
      shard.life -= dt;
      if (shard.life <= 0) {
        this.group.remove(shard.mesh);
        this.shardMaterialPool.push(shard.mesh.material as THREE.MeshLambertMaterial);
        continue;
      }

      // Physics update
      shard.vy += gravity * dt;
      shard.mesh.position.x += shard.vx * dt;
      shard.mesh.position.y += shard.vy * dt;
      shard.mesh.position.z += shard.vz * dt;

      // Floor bounce / stop
      if (shard.mesh.position.y < 0.02) {
        shard.mesh.position.y = 0.02;
        shard.vy = -shard.vy * 0.3; // Dampened bounce
        shard.vx *= 0.7;
        shard.vz *= 0.7;
      }

      // Rotation update
      shard.mesh.rotation.x += shard.rx * dt;
      shard.mesh.rotation.y += shard.ry * dt;
      shard.mesh.rotation.z += shard.rz * dt;

      // Fade & scale shrink
      const progress = shard.life / shard.maxLife;
      const currentScale = shard.initialScale * Math.max(0, progress);
      shard.mesh.scale.set(currentScale, currentScale, currentScale);
      (shard.mesh.material as THREE.MeshLambertMaterial).opacity = Math.min(
        1.0,
        progress * 1.5,
      );

      activeShards.push(shard);
    }
    this.shards = activeShards;

    // Sparks update
    const activeSparks: SparkParticle[] = [];
    for (const spark of this.sparks) {
      spark.life -= dt;
      if (spark.life <= 0) {
        this.group.remove(spark.mesh);
        this.sparkMaterialPool.push(spark.mesh.material as THREE.MeshBasicMaterial);
        continue;
      }

      spark.mesh.position.x += spark.vx * dt;
      spark.mesh.position.y += spark.vy * dt;
      spark.mesh.position.z += spark.vz * dt;

      const progress = spark.life / spark.maxLife;
      (spark.mesh.material as THREE.MeshBasicMaterial).opacity = progress;
      const s = progress * 1.2;
      spark.mesh.scale.set(s, s, s);

      activeSparks.push(spark);
    }
    this.sparks = activeSparks;
  }

  clear() {
    for (const shard of this.shards) {
      this.group.remove(shard.mesh);
      this.shardMaterialPool.push(shard.mesh.material as THREE.MeshLambertMaterial);
    }
    for (const spark of this.sparks) {
      this.group.remove(spark.mesh);
      this.sparkMaterialPool.push(spark.mesh.material as THREE.MeshBasicMaterial);
    }
    this.shards = [];
    this.sparks = [];
  }

  dispose() {
    this.clear();
    for (const mat of this.shardMaterialPool) {
      mat.dispose();
    }
    for (const mat of this.sparkMaterialPool) {
      mat.dispose();
    }
    this.shardMaterialPool = [];
    this.sparkMaterialPool = [];
    this.shardGeometry.dispose();
    this.sparkGeometry.dispose();
  }
}
