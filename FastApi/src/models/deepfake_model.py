"""
src/models/deepfake_model.py

Deepfake model berbasis:
prithivMLmods/deepfake-detector-model-v1

Arsitektur:
    Pretrained SigLIP
          ↓
    Classification Head
          ↓
      Fake / Real

Model dan classifier sama-sama dapat di-fine-tune.

Resume checkpoint TIDAK dilakukan di file ini.
Resume dilakukan oleh train.py karena checkpoint
juga harus menyimpan optimizer, scheduler, scaler, epoch, dll.
"""

import torch
import torch.nn as nn

from transformers import SiglipForImageClassification


# MODEL HUGGING FACE

DEEPFAKE_MODEL_NAME = (
    "prithivMLmods/deepfake-detector-model-v1"
)


#label pelabelan data
ID2LABEL = {
    0: "fake",
    1: "real",
}
#definisi umum tentang real dan fake itu apa
LABEL2ID = {
    "fake": 0,
    "real": 1,
}


#modell adalag yng nanti menjalankan kode nya 

class DeepfakeModel(nn.Module):

    def __init__(
        self,
        freeze_backbone=False,
    ):
        super().__init__()

        # LOAD PRETRAINED MODEL

        self.model = (
            SiglipForImageClassification
            .from_pretrained(
                DEEPFAKE_MODEL_NAME
            )
        )

        # LABEL CONFIG
        self.model.config.id2label = ID2LABEL

        self.model.config.label2id = LABEL2ID


        # FREEZE / UNFREEZE BACKBONE
        
        if freeze_backbone:

            self.freeze_backbone()

        else:

            self.unfreeze_backbone()


    # FREEZE BACKBONE
    
    def freeze_backbone(self):

        """
        Membekukan backbone SigLIP.

        Classifier tetap bisa belajar.
        """

        for name, parameter in (
            self.model.named_parameters()
        ):

            # Classification head tetap trainable.
            if "classifier" in name:

                parameter.requires_grad = True

            else:

                parameter.requires_grad = False


    # UNFREEZE BACKBONE
    
    def unfreeze_backbone(self):

        """
        Membuka seluruh parameter model.

        SigLIP + classifier sama-sama belajar.
        """

        for parameter in (
            self.model.parameters()
        ):

            parameter.requires_grad = True


    # FORWARD
    
    def forward(
        self,
        pixel_values,
        labels=None,
    ):

        """
        Forward pass.

        pixel_values:
            Tensor hasil preprocessing gambar.

        labels:
            0 = fake
            1 = real

        Return:
            logits
            loss
        """

        output = self.model(
            pixel_values=pixel_values,
            labels=labels,
        )

        return output


    # PREDICT
    
    @torch.no_grad()
    def predict(
        self,
        pixel_values,
    ):

        """
        Prediksi gambar.

        Return:
            {
                "label": "fake"/"real",
                "confidence": float,
                "probabilities": {
                    "fake": float,
                    "real": float
                }
            }
        """

        self.eval()

        output = self.model(
            pixel_values=pixel_values
        )

        probabilities = torch.softmax(
            output.logits,
            dim=-1,
        )

        confidence, prediction = (
            torch.max(
                probabilities,
                dim=-1,
            )
        )

        prediction_id = (
            prediction.item()
        )

        return {
            "label": ID2LABEL[
                prediction_id
            ],

            "confidence": (
                confidence.item()
            ),

            "probabilities": {
                "fake": (
                    probabilities[0][0]
                    .item()
                ),

                "real": (
                    probabilities[0][1]
                    .item()
                ),
            },
        }


# LOAD MODEL

def load_deepfake_model(
    freeze_backbone=False,
):

    """
    Membuat model pretrained.

    Default:
        freeze_backbone=False

    Artinya:
        SigLIP      → belajar
        classifier  → belajar
    """

    return DeepfakeModel(
        freeze_backbone=freeze_backbone
    )
