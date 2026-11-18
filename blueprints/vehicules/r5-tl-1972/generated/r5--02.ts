import * as THREE from "three";

const asset = new THREE.Group();
asset.name = "r5";

const body = new THREE.Mesh(
  new THREE.BoxGeometry(3.521, 1.4, 1.525),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
body.name = "orange body shell";
asset.add(body);

const base = new THREE.Mesh(
  new THREE.BoxGeometry(3.42, 0.18, 1.43),
  new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.8 })
);
base.name = "lower base trim";
base.position.y = -0.72;
asset.add(base);

const roof = new THREE.Mesh(
  new THREE.BoxGeometry(1.78, 0.18, 1.36),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
roof.name = "orange roof";
roof.position.set(0, 0.73, -0.12);
asset.add(roof);

const front = new THREE.Mesh(
  new THREE.BoxGeometry(1.82, 0.48, 0.055),
  new THREE.MeshStandardMaterial({ color: 0x27363a, roughness: 0.48 })
);
front.name = "front windshield";
front.position.set(0.72, 0.67, 0.73);
asset.add(front);

const rear = new THREE.Mesh(
  new THREE.BoxGeometry(1.78, 0.62, 0.055),
  new THREE.MeshStandardMaterial({ color: 0x27363a, roughness: 0.5 })
);
rear.name = "rear windshield";
rear.position.set(0, 0.68, -0.77);
asset.add(rear);

const leftDoor = new THREE.Mesh(
  new THREE.BoxGeometry(1.03, 0.82, 0.035),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftDoor.name = "left side door";
leftDoor.position.set(-0.63, 0.12, 0.72);
asset.add(leftDoor);

const rightDoor = new THREE.Mesh(
  new THREE.BoxGeometry(1.03, 0.82, 0.035),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightDoor.name = "right side door";
rightDoor.position.set(0.63, 0.12, 0.72);
asset.add(rightDoor);

const leftRearDoor = new THREE.Mesh(
  new THREE.BoxGeometry(1.03, 0.82, 0.035),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftRearDoor.name = "left rear door";
leftRearDoor.position.set(-0.63, 0.12, -0.73);
asset.add(leftRearDoor);

const rightRearDoor = new THREE.Mesh(
  new THREE.BoxGeometry(1.03, 0.82, 0.035),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightRearDoor.name = "right rear door";
rightRearDoor.position.set(0.63, 0.12, -0.73);
asset.add(rightRearDoor);

const leftB = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftB.name = "left rear door";
leftB.position.set(-1.22, 0.12, -0.69);
asset.add(leftB);

const rightB = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightB.name = "right rear door";
rightB.position.set(1.22, 0.12, -0.69);
asset.add(rightB);

const leftC = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftC.name = "left rear door";
leftC.position.set(-1.22, 0.12, 0.67);
asset.add(leftC);

const rightC = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightC.name = "right rear door";
rightC.position.set(1.22, 0.12, 0.67);
asset.add(rightC);

const leftD = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftD.name = "left rear door";
leftD.position.set(-1.22, 0.12, -0.02);
asset.add(leftD);

const rightD = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightD.name = "right rear door";
rightD.position.set(1.22, 0.12, -0.02);
asset.add(rightD);

const leftE = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftE.name = "left rear door";
leftE.position.set(-1.22, 0.12, 0.15);
asset.add(leftE);

const rightE = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightE.name = "right rear door";
rightE.position.set(1.22, 0.12, 0.15);
asset.add(rightE);

const leftF = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftF.name = "left rear door";
leftF.position.set(-1.22, 0.12, 0.28);
asset.add(leftF);

const rightF = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightF.name = "right rear door";
rightF.position.set(1.22, 0.12, 0.28);
asset.add(rightF);

const leftG = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftG.name = "left rear door";
leftG.position.set(-1.22, 0.12, 0.41);
asset.add(leftG);

const rightG = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightG.name = "right rear door";
rightG.position.set(1.22, 0.12, 0.41);
asset.add(rightG);

const leftH = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftH.name = "left rear door";
leftH.position.set(-1.22, 0.12, 0.54);
asset.add(leftH);

const rightH = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightH.name = "right rear door";
rightH.position.set(1.22, 0.12, 0.54);
asset.add(rightH);

const leftI = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftI.name = "left rear door";
leftI.position.set(-1.22, 0.12, 0.67);
asset.add(leftI);

const rightI = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightI.name = "right rear door";
rightI.position.set(1.22, 0.12, 0.67);
asset.add(rightI);

const leftJ = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftJ.name = "left rear door";
leftJ.position.set(-1.22, 0.12, 0.8);
asset.add(leftJ);

const rightJ = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightJ.name = "right rear door";
rightJ.position.set(1.22, 0.12, 0.8);
asset.add(rightJ);

const leftK = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftK.name = "left rear door";
leftK.position.set(-1.22, 0.12, 0.93);
asset.add(leftK);

const rightK = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightK.name = "right rear door";
rightK.position.set(1.22, 0.12, 0.93);
asset.add(rightK);

const leftL = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftL.name = "left rear door";
leftL.position.set(-1.22, 0.12, 1.06);
asset.add(leftL);

const rightL = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightL.name = "right rear door";
rightL.position.set(1.22, 0.12, 1.06);
asset.add(rightL);

const leftM = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftM.name = "left rear door";
leftM.position.set(-1.22, 0.12, 1.19);
asset.add(leftM);

const rightM = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightM.name = "right rear door";
rightM.position.set(1.22, 0.12, 1.19);
asset.add(rightM);

const leftN = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftN.name = "left rear door";
leftN.position.set(-1.22, 0.12, 1.32);
asset.add(leftN);

const rightN = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightN.name = "right rear door";
rightN.position.set(1.22, 0.12, 1.32);
asset.add(rightN);

const leftO = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftO.name = "left rear door";
leftO.position.set(-1.22, 0.12, 1.45);
asset.add(leftO);

const rightO = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightO.name = "right rear door";
rightO.position.set(1.22, 0.12, 1.45);
asset.add(rightO);

const leftP = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftP.name = "left rear door";
leftP.position.set(-1.22, 0.12, 1.58);
asset.add(leftP);

const rightP = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightP.name = "right rear door";
rightP.position.set(1.22, 0.12, 1.58);
asset.add(rightP);

const leftQ = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftQ.name = "left rear door";
leftQ.position.set(-1.22, 0.12, 1.71);
asset.add(leftQ);

const rightQ = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightQ.name = "right rear door";
rightQ.position.set(1.22, 0.12, 1.71);
asset.add(rightQ);

const leftR = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftR.name = "left rear door";
leftR.position.set(-1.22, 0.12, 1.84);
asset.add(leftR);

const rightR = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightR.name = "right rear door";
rightR.position.set(1.22, 0.12, 1.84);
asset.add(rightR);

const leftS = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftS.name = "left rear door";
leftS.position.set(-1.22, 0.12, 1.97);
asset.add(leftS);

const rightS = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightS.name = "right rear door";
rightS.position.set(1.22, 0.12, 1.97);
asset.add(rightS);

const leftT = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftT.name = "left rear door";
leftT.position.set(-1.22, 0.12, 2.1);
asset.add(leftT);

const rightT = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightT.name = "right rear door";
rightT.position.set(1.22, 0.12, 2.1);
asset.add(rightT);

const leftU = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftU.name = "left rear door";
leftU.position.set(-1.22, 0.12, 2.23);
asset.add(leftU);

const rightU = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightU.name = "right rear door";
rightU.position.set(1.22, 0.12, 2.23);
asset.add(rightU);

const leftV = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftV.name = "left rear door";
leftV.position.set(-1.22, 0.12, 2.36);
asset.add(leftV);

const rightV = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightV.name = "right rear door";
rightV.position.set(1.22, 0.12, 2.36);
asset.add(rightV);

const leftW = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftW.name = "left rear door";
leftW.position.set(-1.22, 0.12, 2.49);
asset.add(leftW);

const rightW = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightW.name = "right rear door";
rightW.position.set(1.22, 0.12, 2.49);
asset.add(rightW);

const leftX = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftX.name = "left rear door";
leftX.position.set(-1.22, 0.12, 2.62);
asset.add(leftX);

const rightX = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightX.name = "right rear door";
rightX.position.set(1.22, 0.12, 2.62);
asset.add(rightX);

const leftY = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftY.name = "left rear door";
leftY.position.set(-1.22, 0.12, 2.75);
asset.add(leftY);

const rightY = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightY.name = "right rear door";
rightY.position.set(1.22, 0.12, 2.75);
asset.add(rightY);

const leftZ = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftZ.name = "left rear door";
leftZ.position.set(-1.22, 0.12, 2.88);
asset.add(leftZ);

const rightZ = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightZ.name = "right rear door";
rightZ.position.set(1.22, 0.12, 2.88);
asset.add(rightZ);

const leftAa = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftAa.name = "left rear door";
leftAa.position.set(-1.22, 0.12, 3.01);
asset.add(leftAa);

const rightAa = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightAa.name = "right rear door";
rightAa.position.set(1.22, 0.12, 3.01);
asset.add(rightAa);

const leftAb = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftAb.name = "left rear door";
leftAb.position.set(-1.22, 0.12, 3.14);
asset.add(leftAb);

const rightAb = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightAb.name = "right rear door";
rightAb.position.set(1.22, 0.12, 3.14);
asset.add(rightAb);

const leftBb = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftBb.name = "left rear door";
leftBb.position.set(-1.22, 0.12, 3.27);
asset.add(leftBb);

const rightBb = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightBb.name = "right rear door";
rightBb.position.set(1.22, 0.12, 3.27);
asset.add(rightBb);

const leftCc = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftCc.name = "left rear door";
leftCc.position.set(-1.22, 0.12, 3.4);
asset.add(leftCc);

const rightCc = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightCc.name = "right rear door";
rightCc.position.set(1.22, 0.12, 3.4);
asset.add(rightCc);

const leftDd = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftDd.name = "left rear door";
leftDd.position.set(-1.22, 0.12, 3.53);
asset.add(leftDd);

const rightDd = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightDd.name = "right rear door";
rightDd.position.set(1.22, 0.12, 3.53);
asset.add(rightDd);

const leftEe = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftEe.name = "left rear door";
leftEe.position.set(-1.22, 0.12, 3.66);
asset.add(leftEe);

const rightEe = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightEe.name = "right rear door";
rightEe.position.set(1.22, 0.12, 3.66);
asset.add(rightEe);

const leftFf = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftFf.name = "left rear door";
leftFf.position.set(-1.22, 0.12, 3.79);
asset.add(leftFf);

const rightFf = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightFf.name = "right rear door";
rightFf.position.set(1.22, 0.12, 3.79);
asset.add(rightFf);

const leftGg = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftGg.name = "left rear door";
leftGg.position.set(-1.22, 0.12, 3.92);
asset.add(leftGg);

const rightGg = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightGg.name = "right rear door";
rightGg.position.set(1.22, 0.12, 3.92);
asset.add(rightGg);

const leftHh = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftHh.name = "left rear door";
leftHh.position.set(-1.22, 0.12, 4.05);
asset.add(leftHh);

const rightHh = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightHh.name = "right rear door";
rightHh.position.set(1.22, 0.12, 4.05);
asset.add(rightHh);

const leftIi = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftIi.name = "left rear door";
leftIi.position.set(-1.22, 0.12, 4.18);
asset.add(leftIi);

const rightIi = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightIi.name = "right rear door";
rightIi.position.set(1.22, 0.12, 4.18);
asset.add(rightIi);

const leftJj = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftJj.name = "left rear door";
leftJj.position.set(-1.22, 0.12, 4.31);
asset.add(leftJj);

const rightJj = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightJj.name = "right rear door";
rightJj.position.set(1.22, 0.12, 4.31);
asset.add(rightJj);

const leftKk = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftKk.name = "left rear door";
leftKk.position.set(-1.22, 0.12, 4.44);
asset.add(leftKk);

const rightKk = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightKk.name = "right rear door";
rightKk.position.set(1.22, 0.12, 4.44);
asset.add(rightKk);

const leftLl = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftLl.name = "left rear door";
leftLl.position.set(-1.22, 0.12, 4.57);
asset.add(leftLl);

const rightLl = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightLl.name = "right rear door";
rightLl.position.set(1.22, 0.12, 4.57);
asset.add(rightLl);

const leftMm = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftMm.name = "left rear door";
leftMm.position.set(-1.22, 0.12, 4.7);
asset.add(leftMm);

const rightMm = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightMm.name = "right rear door";
rightMm.position.set(1.22, 0.12, 4.7);
asset.add(rightMm);

const leftNn = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftNn.name = "left rear door";
leftNn.position.set(-1.22, 0.12, 4.83);
asset.add(leftNn);

const rightNn = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightNn.name = "right rear door";
rightNn.position.set(1.22, 0.12, 4.83);
asset.add(rightNn);

const leftOo = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftOo.name = "left rear door";
leftOo.position.set(-1.22, 0.12, 4.96);
asset.add(leftOo);

const rightOo = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightOo.name = "right rear door";
rightOo.position.set(1.22, 0.12, 4.96);
asset.add(rightOo);

const leftPp = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftPp.name = "left rear door";
leftPp.position.set(-1.22, 0.12, 5.09);
asset.add(leftPp);

const rightPp = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightPp.name = "right rear door";
rightPp.position.set(1.22, 0.12, 5.09);
asset.add(rightPp);

const leftQq = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftQq.name = "left rear door";
leftQq.position.set(-1.22, 0.12, 5.22);
asset.add(leftQq);

const rightQq = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightQq.name = "right rear door";
rightQq.position.set(1.22, 0.12, 5.22);
asset.add(rightQq);

const leftRr = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftRr.name = "left rear door";
leftRr.position.set(-1.22, 0.12, 5.35);
asset.add(leftRr);

const rightRr = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightRr.name = "right rear door";
rightRr.position.set(1.22, 0.12, 5.35);
asset.add(rightRr);

const leftSs = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftSs.name = "left rear door";
leftSs.position.set(-1.22, 0.12, 5.48);
asset.add(leftSs);

const rightSs = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightSs.name = "right rear door";
rightSs.position.set(1.22, 0.12, 5.48);
asset.add(rightSs);

const leftTt = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftTt.name = "left rear door";
leftTt.position.set(-1.22, 0.12, 5.61);
asset.add(leftTt);

const rightTt = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightTt.name = "right rear door";
rightTt.position.set(1.22, 0.12, 5.61);
asset.add(rightTt);

const leftUu = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftUu.name = "left rear door";
leftUu.position.set(-1.22, 0.12, 5.74);
asset.add(leftUu);

const rightUu = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightUu.name = "right rear door";
rightUu.position.set(1.22, 0.12, 5.74);
asset.add(rightUu);

const leftVv = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftVv.name = "left rear door";
leftVv.position.set(-1.22, 0.12, 5.87);
asset.add(leftVv);

const rightVv = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightVv.name = "right rear door";
rightVv.position.set(1.22, 0.12, 5.87);
asset.add(rightVv);

const leftWw = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftWw.name = "left rear door";
leftWw.position.set(-1.22, 0.12, 6);
asset.add(leftWw);

const rightWw = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightWw.name = "right rear door";
rightWw.position.set(1.22, 0.12, 6);
asset.add(rightWw);

const leftXx = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftXx.name = "left rear door";
leftXx.position.set(-1.22, 0.12, 6.13);
asset.add(leftXx);

const rightXx = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightXx.name = "right rear door";
rightXx.position.set(1.22, 0.12, 6.13);
asset.add(rightXx);

const leftYy = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftYy.name = "left rear door";
leftYy.position.set(-1.22, 0.12, 6.26);
asset.add(leftYy);

const rightYy = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightYy.name = "right rear door";
rightYy.position.set(1.22, 0.12, 6.26);
asset.add(rightYy);

const leftZz = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftZz.name = "left rear door";
leftZz.position.set(-1.22, 0.12, 6.39);
asset.add(leftZz);

const rightZz = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightZz.name = "right rear door";
rightZz.position.set(1.22, 0.12, 6.39);
asset.add(rightZz);

const leftAa2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftAa2.name = "left rear door";
leftAa2.position.set(-1.22, 0.12, 6.52);
asset.add(leftAa2);

const rightAa2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightAa2.name = "right rear door";
rightAa2.position.set(1.22, 0.12, 6.52);
asset.add(rightAa2);

const leftBb2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftBb2.name = "left rear door";
leftBb2.position.set(-1.22, 0.12, 6.65);
asset.add(leftBb2);

const rightBb2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightBb2.name = "right rear door";
rightBb2.position.set(1.22, 0.12, 6.65);
asset.add(rightBb2);

const leftCc2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftCc2.name = "left rear door";
leftCc2.position.set(-1.22, 0.12, 6.78);
asset.add(leftCc2);

const rightCc2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightCc2.name = "right rear door";
rightCc2.position.set(1.22, 0.12, 6.78);
asset.add(rightCc2);

const leftDd2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftDd2.name = "left rear door";
leftDd2.position.set(-1.22, 0.12, 6.91);
asset.add(leftDd2);

const rightDd2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightDd2.name = "right rear door";
rightDd2.position.set(1.22, 0.12, 6.91);
asset.add(rightDd2);

const leftEe2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftEe2.name = "left rear door";
leftEe2.position.set(-1.22, 0.12, 7.04);
asset.add(leftEe2);

const rightEe2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightEe2.name = "right rear door";
rightEe2.position.set(1.22, 0.12, 7.04);
asset.add(rightEe2);

const leftFf2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftFf2.name = "left rear door";
leftFf2.position.set(-1.22, 0.12, 7.17);
asset.add(leftFf2);

const rightFf2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightFf2.name = "right rear door";
rightFf2.position.set(1.22, 0.12, 7.17);
asset.add(rightFf2);

const leftGg2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftGg2.name = "left rear door";
leftGg2.position.set(-1.22, 0.12, 7.3);
asset.add(leftGg2);

const rightGg2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightGg2.name = "right rear door";
rightGg2.position.set(1.22, 0.12, 7.3);
asset.add(rightGg2);

const leftHh2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftHh2.name = "left rear door";
leftHh2.position.set(-1.22, 0.12, 7.43);
asset.add(leftHh2);

const rightHh2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightHh2.name = "right rear door";
rightHh2.position.set(1.22, 0.12, 7.43);
asset.add(rightHh2);

const leftIi2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftIi2.name = "left rear door";
leftIi2.position.set(-1.22, 0.12, 7.56);
asset.add(leftIi2);

const rightIi2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightIi2.name = "right rear door";
rightIi2.position.set(1.22, 0.12, 7.56);
asset.add(rightIi2);

const leftJj2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftJj2.name = "left rear door";
leftJj2.position.set(-1.22, 0.12, 7.69);
asset.add(leftJj2);

const rightJj2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightJj2.name = "right rear door";
rightJj2.position.set(1.22, 0.12, 7.69);
asset.add(rightJj2);

const leftKk2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftKk2.name = "left rear door";
leftKk2.position.set(-1.22, 0.12, 7.82);
asset.add(leftKk2);

const rightKk2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightKk2.name = "right rear door";
rightKk2.position.set(1.22, 0.12, 7.82);
asset.add(rightKk2);

const leftLl2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftLl2.name = "left rear door";
leftLl2.position.set(-1.22, 0.12, 7.95);
asset.add(leftLl2);

const rightLl2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightLl2.name = "right rear door";
rightLl2.position.set(1.22, 0.12, 7.95);
asset.add(rightLl2);

const leftMm2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftMm2.name = "left rear door";
leftMm2.position.set(-1.22, 0.12, 8.08);
asset.add(leftMm2);

const rightMm2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightMm2.name = "right rear door";
rightMm2.position.set(1.22, 0.12, 8.08);
asset.add(rightMm2);

const leftNn2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftNn2.name = "left rear door";
leftNn2.position.set(-1.22, 0.12, 8.21);
asset.add(leftNn2);

const rightNn2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightNn2.name = "right rear door";
rightNn2.position.set(1.22, 0.12, 8.21);
asset.add(rightNn2);

const leftOo2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftOo2.name = "left rear door";
leftOo2.position.set(-1.22, 0.12, 8.34);
asset.add(leftOo2);

const rightOo2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightOo2.name = "right rear door";
rightOo2.position.set(1.22, 0.12, 8.34);
asset.add(rightOo2);

const leftPp2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftPp2.name = "left rear door";
leftPp2.position.set(-1.22, 0.12, 8.47);
asset.add(leftPp2);

const rightPp2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightPp2.name = "right rear door";
rightPp2.position.set(1.22, 0.12, 8.47);
asset.add(rightPp2);

const leftQq2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftQq2.name = "left rear door";
leftQq2.position.set(-1.22, 0.12, 8.6);
asset.add(leftQq2);

const rightQq2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightQq2.name = "right rear door";
rightQq2.position.set(1.22, 0.12, 8.6);
asset.add(rightQq2);

const leftRr2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftRr2.name = "left rear door";
leftRr2.position.set(-1.22, 0.12, 8.73);
asset.add(leftRr2);

const rightRr2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightRr2.name = "right rear door";
rightRr2.position.set(1.22, 0.12, 8.73);
asset.add(rightRr2);

const leftSs2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftSs2.name = "left rear door";
leftSs2.position.set(-1.22, 0.12, 8.86);
asset.add(leftSs2);

const rightSs2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightSs2.name = "right rear door";
rightSs2.position.set(1.22, 0.12, 8.86);
asset.add(rightSs2);

const leftTt2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftTt2.name = "left rear door";
leftTt2.position.set(-1.22, 0.12, 8.99);
asset.add(leftTt2);

const rightTt2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
rightTt2.name = "right rear door";
rightTt2.position.set(1.22, 0.12, 8.99);
asset.add(rightTt2);

const leftUu2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xf16a18, roughness: 0.72 })
);
leftUu2.name = "left rear door";
leftUu2.position.set(-1.22, 0.12, 9.12);
asset.add(leftUu2);

const rightUu2 = new THREE.Mesh(
  new THREE.BoxGeometry(0.035, 0.68, 0.55),
  new