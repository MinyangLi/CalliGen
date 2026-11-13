# CalliGen-Generating-Chinese-Characters-with-Hand-written-Skeleton-and-Font-Stroke-Style
![Qualitative Results](assets/qualitative.png)
## Generation
### Requirements
Run the Python commands below from the repository root on the A800 Linux machine. They do not require Slurm, SSH, or `sbatch`.

Use a CUDA build of PyTorch that matches the machine's NVIDIA driver; see the [official PyTorch installation instructions](https://pytorch.org/get-started/locally/). The following [PyTorch 2.8.0 example](https://pytorch.org/get-started/previous-versions/) requires a driver compatible with CUDA 12.6:

```bash
nvidia-smi
python -m pip install torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu126
python -m pip install -r requirements.txt
python -c "import torch; assert torch.cuda.is_available(), 'CUDA is unavailable'; print(torch.cuda.get_device_name(0))"
```

`requirements.txt` contains the training and inference dependencies. `requirements_full.txt` is the original environment export and contains machine-specific paths.

### Data preparation
#### 1. Prepare your TrueType font file.
#### 2. Set the font path and output directory for `generate_better_data.py`.
#### 3. Run the following command
```bash
export CALLIGEN_FONT_PATH=/path/to/your_font.ttf
export CALLIGEN_DATA_DIR=/path/to/data
python generate_better_data.py
```

This creates `real_samples/` and `skeleton/` inside `CALLIGEN_DATA_DIR`. Keep each target image paired with its corresponding `<stem>_dilated_k3.png` skeleton. `generate_data.py` also provides the preprocessing functions imported by training and inference; its single-character generator uses `<stem>_skeleton_dilated_k3.png`, which the training loader also accepts.

### Training
```bash
CUDA_VISIBLE_DEVICES=0 python train_eval.py \
  --real_dir /path/to/data/real_samples \
  --sk_dir /path/to/data/skeleton \
  --out_dir ./pix2pix_runs/my_font \
  --img_size 512 --batch 8 --max_steps 100000 \
  --ckpt_freq 1000 --amp
```

The script uses CUDA when available. `--batch 8` is a starting value; adjust it to fit the available GPU memory and dataset size. Checkpoints are saved under the output directory's `checkpoints/` folder, including `final.pt` when training finishes. The default LPIPS loss downloads pretrained VGG weights on first use; `--no-lpips` disables that loss.

### Inferencing
```bash
CUDA_VISIBLE_DEVICES=0 python inference_pix2pix.py \
  --ckpt ./pix2pix_runs/my_font/checkpoints/final.pt \
  --input ./inference_skeleton/永.jpg \
  --out ./outputs/永.png
```

The repository contains the code and sample inputs. Supply your font/training data and a trained checkpoint, or train a checkpoint with the command above. The commands use one visible GPU; the training script does not implement distributed training.

## Frontend

The React + TypeScript interface is in [`web/frontend`](web/frontend). To run it locally:

```bash
cd web/frontend
npm ci
npm run dev
```

Open `/calligen` at the address printed by Vite. The interface runs independently; AI generation requires a separately configured backend. See the [frontend README](web/frontend/README.md) for build and preview commands.
